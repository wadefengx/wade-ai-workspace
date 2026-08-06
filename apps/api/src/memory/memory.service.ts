import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MemoryLevel, MemoryType, Prisma, WorkspaceRole } from "@prisma/client";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { AIProvider, AI_PROVIDER, ChatCompletionMessage } from "../ai/providers/ai-provider";
import { parseAgentProviderConfigRef } from "../agents/agent-provider-config";
import { EmbeddingService } from "../ai/embedding.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemoryDto } from "./dto/create-memory.dto";
import { UpdateMemoryDto } from "./dto/update-memory.dto";

const EXTRACTION_BATCH = 20;
const L1_DEDUP_THRESHOLD = 0.92;

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider
  ) {}

  async listVisibleMemories(workspaceId: string, userId: string) {
    if (await isGlobalAdmin(this.prisma, userId)) {
      return this.prisma.memory.findMany({
        where: { workspaceId },
        orderBy: [{ level: "asc" }, { createdAt: "asc" }]
      });
    }

    return this.prisma.memory.findMany({
      where: this.buildVisibleWhere(workspaceId, userId),
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });
  }

  async listPromptMemories(workspaceId: string, userId: string) {
    if (await isGlobalAdmin(this.prisma, userId)) {
      return this.prisma.memory.findMany({
        where: {
          workspaceId,
          enabled: true
        },
        orderBy: [{ level: "asc" }, { createdAt: "asc" }]
      });
    }

    return this.prisma.memory.findMany({
      where: this.buildVisibleWhere(workspaceId, userId, true),
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });
  }

  createMemory(workspaceId: string, userId: string, dto: CreateMemoryDto) {
    return this.prisma.memory.create({
      data: {
        workspaceId,
        type: dto.type,
        content: dto.content,
        level: dto.level ?? MemoryLevel.L1_ATOM,
        userId: dto.type === MemoryType.PERSONAL ? userId : null,
        createdBy: userId
      }
    });
  }

  async updateMemory(memoryId: string, userId: string, dto: UpdateMemoryDto) {
    if (dto.content === undefined && dto.enabled === undefined) {
      throw new BadRequestException("至少提供一个可更新字段");
    }

    const memory = await this.ensureManagePermission(memoryId, userId);

    return this.prisma.memory.update({
      where: { id: memory.id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });
  }

  async deleteMemory(memoryId: string, userId: string) {
    const memory = await this.ensureManagePermission(memoryId, userId);

    return this.prisma.memory.delete({
      where: { id: memory.id }
    });
  }

  /**
   * TencentDB-Agent-Memory 创意落地:L0 对话 → L1 原子事实 → L2 场景 → L3 画像。
   * 取频道最近 N 条消息,单次 LLM 调用(JSON)抽取场景分段 + 原子事实,L1 按 embedding 余弦去重。
   */
  async extractFromConversation(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, workspaceId: true }
    });

    if (!channel) {
      throw new NotFoundException("频道不存在");
    }

    // 取 workspace 默认 agent 的 provider 配置,LLM 抽取必须走真实模型
    const agentConfig = await this.resolveAgentConfig(channel.workspaceId);
    if (!agentConfig) {
      this.logger.warn("记忆抽取跳过:workspace 无可用默认 Agent(未配置 provider)");
      return { success: false, extractedCount: 0, storedCount: 0, sceneNames: [], reason: "NO_AGENT_CONFIG" };
    }

    const recentMessages = await this.prisma.message.findMany({
      where: { channelId, senderType: "USER" },
      orderBy: { createdAt: "desc" },
      take: EXTRACTION_BATCH
    });

    if (recentMessages.length === 0) {
      return { success: true, extractedCount: 0, storedCount: 0, sceneNames: [] };
    }

    const messages = recentMessages.reverse().map((m) => `${m.content}`).join("\n");
    const prompt = this.buildExtractionPrompt(messages);

    try {
      const response = await this.collectProviderResponse([
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ], agentConfig);

      const parsed = this.parseExtractionResponse(response);
      if (!parsed) {
        return { success: false, extractedCount: 0, storedCount: 0, sceneNames: [] };
      }

      const stored: Array<{ id: string; content: string; type: MemoryType; level: MemoryLevel; priority: number }> = [];
      const sceneNames: string[] = [];

      for (const scene of parsed.scenes ?? []) {
        const sceneName = String(scene.scene_name ?? "未命名场景").slice(0, 80);
        sceneNames.push(sceneName);

        for (const memory of scene.memories ?? []) {
          const content = String(memory.content ?? "").trim();
          if (!content) {
            continue;
          }

          const deduped = await this.isDuplicateL1(channel.workspaceId, content);
          if (deduped) {
            continue;
          }

          const type = this.mapMemoryType(String(memory.type ?? "TEAM"));
          const priority = typeof memory.priority === "number" ? memory.priority : 0;
          const embedding = (await this.embeddingService.embed(content)) ?? [];
          const record = await this.prisma.memory.create({
            data: {
              workspaceId: channel.workspaceId,
              userId: type === MemoryType.PERSONAL ? userId : null,
              type,
              level: MemoryLevel.L1_ATOM,
              content,
              priority,
              embedding,
              createdBy: userId
            }
          });
          stored.push({ id: record.id, content, type, level: MemoryLevel.L1_ATOM, priority });
        }
      }

      if (stored.length > 0) {
        await this.aggregateScenarios(channel.workspaceId, stored, userId, agentConfig);
      }

      return { success: true, extractedCount: parsed.scenes?.length ?? 0, storedCount: stored.length, sceneNames };
    } catch (error) {
      this.logger.warn(`记忆抽取失败(降级): ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, extractedCount: 0, storedCount: 0, sceneNames: [] };
    }
  }

  /** 解析 workspace 默认 agent 的 provider 配置(LLM 抽取用) */
  private async resolveAgentConfig(workspaceId: string): Promise<{ baseUrl?: string; apiKey?: string; model?: string } | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultAgentId: true }
    });

    const agent = workspace?.defaultAgentId
      ? await this.prisma.agent.findUnique({ where: { id: workspace.defaultAgentId } })
      : await this.prisma.agent.findFirst({ where: { workspaceId, isDefault: true } });

    if (!agent) {
      return null;
    }

    const config = parseAgentProviderConfigRef(agent.providerConfigRef);
    if (!config.baseUrl || !config.apiKey) {
      return null;
    }

    return config;
  }

  /** L2 场景聚合:把同批 L1 按主题聚类为场景记忆 */
  private async aggregateScenarios(workspaceId: string, memories: Array<{ id: string; content: string; type: MemoryType; level: MemoryLevel; priority: number }>, userId: string, agentConfig: { baseUrl?: string; apiKey?: string; model?: string }) {
    try {
      const summary = memories.map((m, i) => `${i + 1}. ${m.content.slice(0, 120)}`).join("\n");
      const response = await this.collectProviderResponse([
        { role: "system", content: SCENARIO_SYSTEM_PROMPT },
        { role: "user", content: `请把以下原子记忆聚合为 1-2 个场景主题:\n${summary}` }
      ], agentConfig);

      const scenes = this.parseScenarioResponse(response);
      for (const scene of scenes) {
        const exists = await this.prisma.memory.findFirst({
          where: { workspaceId, level: MemoryLevel.L2_SCENARIO, content: scene }
        });
        if (!exists) {
          await this.prisma.memory.create({
            data: {
              workspaceId,
              type: MemoryType.TEAM,
              level: MemoryLevel.L2_SCENARIO,
              content: scene,
              sourceMessageIds: memories.map((m) => m.id),
              createdBy: userId
            }
          });
        }
      }
    } catch (error) {
      this.logger.warn(`场景聚合失败(降级): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** L1 去重:同 workspace 已有语义近似(embedding 余弦 > 阈值)则跳过 */
  private async isDuplicateL1(workspaceId: string, content: string): Promise<boolean> {
    try {
      const existing = await this.prisma.memory.findMany({
        where: { workspaceId, level: MemoryLevel.L1_ATOM },
        select: { id: true, content: true, embedding: true },
        take: 100
      });

      if (existing.length === 0) {
        return false;
      }

      const queryEmbedding = await this.embeddingService.embed(content);
      if (!queryEmbedding) {
        return false;
      }

      const candidates = existing.filter((e) => Array.isArray(e.embedding) && (e.embedding as number[]).length > 0) as Array<{ id: string; content: string; embedding: number[] }>;
      return candidates.some((e) => this.cosineSimilarity(queryEmbedding, e.embedding) > L1_DEDUP_THRESHOLD);
    } catch {
      return false;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async collectProviderResponse(messages: ChatCompletionMessage[], agentConfig: { baseUrl?: string; apiKey?: string; model?: string }): Promise<string> {
    let full = "";
    for await (const event of this.aiProvider.stream({ messages, provider: agentConfig })) {
      if (event.type === "token") {
        full += event.content;
      }
    }
    return full;
  }

  private parseExtractionResponse(raw: string): { scenes?: Array<{ scene_name?: string; memories?: Array<{ content?: string; type?: string; priority?: number }> }> } | null {
    const json = this.extractJson(raw);
    if (!json) {
      return null;
    }
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? { scenes: parsed } : parsed;
    } catch {
      return null;
    }
  }

  private parseScenarioResponse(raw: string): string[] {
    const json = this.extractJson(raw);
    if (!json) {
      return [];
    }
    try {
      const parsed = JSON.parse(json);
      const arr = Array.isArray(parsed) ? parsed : parsed.scenes;
      return (Array.isArray(arr) ? arr : []).map((s: unknown) => String(typeof s === "object" && s && "summary" in s ? (s as { summary: string }).summary : s).slice(0, 200));
    } catch {
      return [];
    }
  }

  private extractJson(raw: string): string | null {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return match ? match[0] : null;
  }

  private mapMemoryType(type: string): MemoryType {
    const normalized = type.toUpperCase();
    if (normalized.includes("PERSONAL") || normalized.includes("PREFERENCE")) {
      return MemoryType.PERSONAL;
    }
    if (normalized.includes("PROJECT") || normalized.includes("DECISION") || normalized.includes("LESSON")) {
      return MemoryType.PROJECT;
    }
    return MemoryType.TEAM;
  }

  private buildExtractionPrompt(messages: string): string {
    return `以下是频道中最近的对话:\n\n${messages}\n\n请按场景分段并抽取原子记忆。`;
  }

  private buildVisibleWhere(workspaceId: string, userId: string, enabledOnly = false): Prisma.MemoryWhereInput {
    return {
      workspaceId,
      ...(enabledOnly ? { enabled: true } : {}),
      OR: [{
        type: MemoryType.PERSONAL,
        userId
      }, {
        type: {
          in: [MemoryType.TEAM, MemoryType.PROJECT]
        }
      }]
    };
  }

  private async ensureManagePermission(memoryId: string, userId: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id: memoryId }
    });

    if (!memory) {
      throw new NotFoundException("记忆不存在");
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: memory.workspaceId,
        userId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!membership) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return memory;
      }

      throw new ForbiddenException("无权访问该工作区");
    }

    if (
      memory.createdBy !== userId
      && membership.role !== WorkspaceRole.OWNER
      && !(await isGlobalAdmin(this.prisma, userId))
    ) {
      throw new ForbiddenException("无权修改该记忆");
    }

    return memory;
  }
}

const EXTRACTION_SYSTEM_PROMPT = [
  "你是记忆抽取引擎。把对话按主题场景分段,并抽取可长期复用的原子记忆。",
  "只输出 JSON,格式:",
  '[{"scene_name": "场景名", "memories": [{"content": "原子事实", "type": "FACT|PREFERENCE|DECISION|LESSON", "priority": 0-5}]}]',
  "规则:content 要自包含、可独立理解;不抽取寒暄;PREFERENCE 用于用户偏好,其他用 FACT。"
].join(" ");

const SCENARIO_SYSTEM_PROMPT = [
  "你是场景聚合引擎。把输入的原子记忆按主题聚合为 1-2 个场景摘要。",
  "只输出 JSON:{\"scenes\": [{\"summary\": \"场景摘要(一句话,≤50字)\"}]}"
].join(" ");
