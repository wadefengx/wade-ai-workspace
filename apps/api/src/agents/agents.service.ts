import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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
        systemPrompt: dto.systemPrompt
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
      throw new NotFoundException("Agent 不存在");
    }

    await this.ensureWorkspaceMember(agent.workspaceId, userId);

    if (
      dto.name === undefined &&
      dto.providerConfig === undefined &&
      dto.emoji === undefined &&
      dto.role === undefined &&
      dto.description === undefined &&
      dto.systemPrompt === undefined &&
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
        ...(dto.providerConfig !== undefined
          ? { providerConfigRef: serializeAgentProviderConfig(nextProviderConfig) }
          : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt } : {}),
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
      throw new NotFoundException("Agent 不存在");
    }

    await this.ensureWorkspaceManager(agent.workspaceId, userId);

    if (agent.isDefault) {
      throw new BadRequestException("默认 Agent 不可删除");
    }

    await this.prisma.agent.delete({
      where: { id: agentId }
    });

    return { id: agentId };
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

      throw new ForbiddenException("无权访问该工作区");
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
      throw new ForbiddenException("无权访问该工作区");
    }

    throw new ForbiddenException("仅 OWNER 或 ADMIN 可执行该操作");
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
