import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AgentType, WorkspaceRole } from "@prisma/client";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import {
  AgentProviderConfig,
  parseAgentProviderConfigRef,
  serializeAgentProviderConfig,
  summarizeAgentProviderConfig
} from "./agent-provider-config";

import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listWorkspaceAgents(workspaceId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true,
        embeddingModel: true,
        embeddingBaseUrl: true,
        emoji: true,
        role: true,
        description: true,
        systemPrompt: true,
        harness: true
      }
    });

    return agents.map((agent) => this.toResponse(agent));
  }

  async createAgent(workspaceId: string, userId: string, dto: CreateAgentDto) {
    await this.ensureWorkspaceManager(workspaceId, userId);

    const createdAgent = await this.prisma.agent.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type,
        engineType: "default-chat",
        providerConfigRef: serializeAgentProviderConfig(dto.providerConfig ?? {}),
        embeddingModel: dto.embeddingModel,
        embeddingBaseUrl: dto.embeddingBaseUrl,
        emoji: dto.emoji,
        role: dto.role,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        harness: dto.harness
      },
      select: {
        id: true,
        name: true,
        type: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true,
        embeddingModel: true,
        embeddingBaseUrl: true,
        emoji: true,
        role: true,
        description: true,
        systemPrompt: true,
        harness: true
      }
    });

    this.logger.log(`Created agent ${createdAgent.id} in workspace ${workspaceId}`);
    return this.toResponse(createdAgent);
  }

  async updateAgent(agentId: string, userId: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        type: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true,
        embeddingModel: true,
        embeddingBaseUrl: true,
        emoji: true,
        role: true,
        description: true,
        systemPrompt: true,
        harness: true
      }
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    await this.ensureWorkspaceManager(agent.workspaceId, userId);

    if (
      dto.name === undefined &&
      dto.type === undefined &&
      dto.providerConfig === undefined &&
      dto.emoji === undefined &&
      dto.role === undefined &&
      dto.description === undefined &&
      dto.systemPrompt === undefined &&
      dto.harness === undefined &&
      dto.embeddingModel === undefined &&
      dto.embeddingBaseUrl === undefined
    ) {
      return this.toResponse(agent);
    }

    const nextProviderConfig = this.mergeProviderConfig(agent.providerConfigRef, dto.providerConfig);
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.providerConfig !== undefined
          ? { providerConfigRef: serializeAgentProviderConfig(nextProviderConfig) }
          : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.harness !== undefined ? { harness: dto.harness } : {}),
        ...(dto.embeddingModel !== undefined ? { embeddingModel: dto.embeddingModel } : {}),
        ...(dto.embeddingBaseUrl !== undefined ? { embeddingBaseUrl: dto.embeddingBaseUrl } : {})
      },
      select: {
        id: true,
        name: true,
        type: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true,
        embeddingModel: true,
        embeddingBaseUrl: true,
        emoji: true,
        role: true,
        description: true,
        systemPrompt: true,
        harness: true
      }
    });

    this.logger.log(`Updated agent ${agentId}`);
    return this.toResponse(updatedAgent);
  }

  async deleteAgent(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        isDefault: true
      }
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    await this.ensureWorkspaceManager(agent.workspaceId, userId);

    if (agent.isDefault) {
      throw new BadRequestException("The default agent cannot be deleted");
    }

    await this.prisma.agent.delete({
      where: { id: agentId }
    });

    this.logger.log(`Deleted agent ${agentId}`);
    return { id: agentId };
  }

  async testConnection(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        type: true,
        providerConfigRef: true
      }
    });

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    await this.ensureWorkspaceManager(agent.workspaceId, userId);

    const providerConfig = parseAgentProviderConfigRef(agent.providerConfigRef);

    try {
      if (agent.type === AgentType.ANTHROPIC) {
        return await this.testAnthropicConnection(providerConfig);
      }

      return await this.testOpenAICompatibleConnection(providerConfig);
    } catch (error) {
      this.logger.warn(`Agent connection test failed for ${agentId}: ${this.normalizeError(error)}`);
      return {
        ok: false,
        message: "Connection test failed"
      };
    }
  }

  private async testOpenAICompatibleConnection(config: AgentProviderConfig) {
    const baseUrl = (config.baseUrl || process.env.AI_PROVIDER_BASE_URL || "http://ollama:11434/v1").replace(/\/$/, "");
    const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
    const model = config.model || process.env.AI_PROVIDER_MODEL || "gpt-4o-mini";
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1
      }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return this.connectionFailure(response.status);
    }

    return { ok: true, message: "Connection successful" };
  }

  private async testAnthropicConnection(config: AgentProviderConfig) {
    const baseUrl = (config.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    const endpoint = baseUrl.endsWith("/messages") ? baseUrl : `${baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/messages`;
    const model = config.model || "claude-3-5-sonnet-latest";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(config.apiKey ? { "x-api-key": config.apiKey } : {})
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }]
      }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return this.connectionFailure(response.status);
    }

    return { ok: true, message: "Connection successful" };
  }

  private connectionFailure(status: number) {
    if (status === 401 || status === 403) {
      return { ok: false, status, message: "Provider authentication failed" };
    }

    if (status === 408 || status === 504) {
      return { ok: false, status, message: "Provider request timed out" };
    }

    if (status === 429) {
      return { ok: false, status, message: "Provider rate limit reached" };
    }

    if (status >= 500) {
      return { ok: false, status, message: "Provider is temporarily unavailable" };
    }

    return { ok: false, status, message: "Provider connection failed" };
  }

  private normalizeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private mergeProviderConfig(providerConfigRef: string | null, patch?: UpdateAgentDto["providerConfig"]) {
    const currentConfig = parseAgentProviderConfigRef(providerConfigRef);

    if (!patch) {
      return currentConfig;
    }

    const nextConfig: AgentProviderConfig = {
      ...currentConfig
    };

    if (patch.baseUrl !== undefined) {
      nextConfig.baseUrl = patch.baseUrl;
    }

    if (patch.model !== undefined) {
      nextConfig.model = patch.model;
    }

    if (patch.apiKey !== undefined && patch.apiKey.trim()) {
      nextConfig.apiKey = patch.apiKey;
    }

    return nextConfig;
  }

  private async ensureWorkspaceMember(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true }
    });

    if (!membership) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return;
      }

      throw new ForbiddenException("You do not have access to this workspace");
    }
  }

  private async ensureWorkspaceManager(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true }
    });

    if (membership && membership.role !== WorkspaceRole.MEMBER) {
      return;
    }

    if (await isGlobalAdmin(this.prisma, userId)) {
      return;
    }

    if (!membership) {
      throw new ForbiddenException("You do not have access to this workspace");
    }

    throw new ForbiddenException("Only an OWNER or ADMIN can perform this action");
  }

  private toResponse(agent: {
    id: string;
    name: string;
    type: AgentType;
    engineType: string;
    isDefault: boolean;
    providerConfigRef: string | null;
    embeddingModel?: string | null;
    embeddingBaseUrl?: string | null;
    emoji?: string | null;
    role?: string | null;
    description?: string | null;
    systemPrompt?: string | null;
    harness?: string;
  }) {
    return {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      engineType: agent.engineType,
      isDefault: agent.isDefault,
      providerConfig: summarizeAgentProviderConfig(parseAgentProviderConfigRef(agent.providerConfigRef)),
      embeddingModel: agent.embeddingModel ?? null,
      embeddingBaseUrl: agent.embeddingBaseUrl ?? null,
      emoji: agent.emoji ?? null,
      role: agent.role ?? null,
      description: agent.description ?? null,
      systemPrompt: agent.systemPrompt ?? null,
      harness: agent.harness ?? "OLLAMA"
    };
  }
}
