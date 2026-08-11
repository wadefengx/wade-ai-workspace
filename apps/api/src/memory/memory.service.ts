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

  async createMemory(workspaceId: string, userId: string, dto: CreateMemoryDto) {
    const memory = await this.prisma.memory.create({
      data: {
        workspaceId,
        type: dto.type,
        content: dto.content,
        level: dto.level ?? MemoryLevel.L1_ATOM,
        userId: dto.type === MemoryType.PERSONAL ? userId : null,
        createdBy: userId
      }
    });
    this.logger.log(`Created memory ${memory.id} in workspace ${workspaceId}`);
    return memory;
  }

  async updateMemory(memoryId: string, userId: string, dto: UpdateMemoryDto) {
    if (dto.content === undefined && dto.enabled === undefined) {
      throw new BadRequestException("Provide at least one field to update");
    }

    const memory = await this.ensureManagePermission(memoryId, userId);

    const updatedMemory = await this.prisma.memory.update({
      where: { id: memory.id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });
    this.logger.log(`Updated memory ${memoryId}`);
    return updatedMemory;
  }

  async deleteMemory(memoryId: string, userId: string) {
    const memory = await this.ensureManagePermission(memoryId, userId);

    const deletedMemory = await this.prisma.memory.delete({
      where: { id: memory.id }
    });
    this.logger.log(`Deleted memory ${memoryId}`);
    return deletedMemory;
  }

  /**
   * TencentDB-Agent-Memory implementation: L0 conversations → L1 atomic facts → L2 scenarios → L3 profiles.
   * Retrieve the latest N channel messages and use one LLM call (JSON) to extract scenario segments and atomic facts; deduplicate L1 entries by embedding cosine similarity.
   */
  async extractFromConversation(workspaceId: string, channelId: string, userId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true, workspaceId: true }
    });

    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    // Use the workspace default agent provider configuration; LLM extraction must use a real model.
    const agentConfig = await this.resolveAgentConfig(channel.workspaceId);
    if (!agentConfig) {
      this.logger.warn("Memory extraction skipped: the workspace has no available default agent (provider not configured)");
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

      // ponytail: fetch the existing L1 set once per call instead of re-querying per candidate memory.
      const existingL1 = await this.prisma.memory.findMany({
        where: { workspaceId: channel.workspaceId, level: MemoryLevel.L1_ATOM },
        select: { id: true, content: true, embedding: true },
        take: 100
      });
      const dedupCandidates = existingL1.filter((e) => Array.isArray(e.embedding) && (e.embedding as number[]).length > 0) as Array<{ id: string; content: string; embedding: number[] }>;

      for (const scene of parsed.scenes ?? []) {
        const sceneName = String(scene.scene_name ?? "Untitled scenario").slice(0, 80);
        sceneNames.push(sceneName);

        for (const memory of scene.memories ?? []) {
          const content = String(memory.content ?? "").trim();
          if (!content) {
            continue;
          }

          const deduped = await this.isDuplicateL1(content, dedupCandidates);
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
          // ponytail: keep newly stored memories visible to dedup within this same batch.
          if (embedding.length > 0) {
            dedupCandidates.push({ id: record.id, content, embedding });
          }
        }
      }

      if (stored.length > 0) {
        await this.aggregateScenarios(channel.workspaceId, stored, userId, agentConfig);
      }

      return { success: true, extractedCount: parsed.scenes?.length ?? 0, storedCount: stored.length, sceneNames };
    } catch (error) {
      this.logger.warn(`Memory extraction failed (falling back): ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, extractedCount: 0, storedCount: 0, sceneNames: [] };
    }
  }

  /** Resolve the workspace default agent provider configuration for LLM extraction. */
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

  /** L2 scenario aggregation: cluster the same batch of L1 entries into scenario memories by topic. */
  private async aggregateScenarios(workspaceId: string, memories: Array<{ id: string; content: string; type: MemoryType; level: MemoryLevel; priority: number }>, userId: string, agentConfig: { baseUrl?: string; apiKey?: string; model?: string }) {
    try {
      const summary = memories.map((m, i) => `${i + 1}. ${m.content.slice(0, 120)}`).join("\n");
      const response = await this.collectProviderResponse([
        { role: "system", content: SCENARIO_SYSTEM_PROMPT },
        { role: "user", content: `Aggregate the following atomic memories into 1-2 scenario topics:\n${summary}` }
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
      this.logger.warn(`Scenario aggregation failed (falling back): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** L1 deduplication: skip entries that are semantically similar to existing candidates (embedding cosine similarity > threshold). */
  private async isDuplicateL1(content: string, candidates: Array<{ id: string; content: string; embedding: number[] }>): Promise<boolean> {
    try {
      if (candidates.length === 0) {
        return false;
      }

      const queryEmbedding = await this.embeddingService.embed(content);
      if (!queryEmbedding) {
        return false;
      }

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
    return `Here are the latest channel conversations:\n\n${messages}\n\nSegment them by scenario and extract atomic memories.`;
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
      throw new NotFoundException("Memory not found");
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

      throw new ForbiddenException("You do not have access to this workspace");
    }

    if (
      memory.createdBy !== userId
      && membership.role !== WorkspaceRole.OWNER
      && !(await isGlobalAdmin(this.prisma, userId))
    ) {
      throw new ForbiddenException("You do not have permission to modify this memory");
    }

    return memory;
  }
}

const EXTRACTION_SYSTEM_PROMPT = [
  "You are a memory extraction engine. Segment conversations into topical scenarios and extract atomic memories that can be reused long-term.",
  "Output JSON only, in this format:",
  '[{"scene_name": "Scenario name", "memories": [{"content": "Atomic fact", "type": "FACT|PREFERENCE|DECISION|LESSON", "priority": 0-5}]}]',
  "Rules: content must be self-contained and independently understandable; do not extract pleasantries; use PREFERENCE for user preferences and FACT for everything else."
].join(" ");

const SCENARIO_SYSTEM_PROMPT = [
  "You are a scenario aggregation engine. Group the input atomic memories by topic into 1-2 scenario summaries.",
  "Output JSON only: {\"scenes\": [{\"summary\": \"Scenario summary (one sentence, ≤50 characters)\"}]}"
].join(" ");
