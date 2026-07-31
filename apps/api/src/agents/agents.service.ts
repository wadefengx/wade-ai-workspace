import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import {
  AgentProviderConfig,
  parseAgentProviderConfigRef,
  serializeAgentProviderConfig,
  summarizeAgentProviderConfig
} from "./agent-provider-config";
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
        engineType: true,
        isDefault: true,
        providerConfigRef: true
      }
    });

    return agents.map((agent) => this.toResponse(agent));
  }

  async updateAgent(agentId: string, userId: string, dto: UpdateAgentDto) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true
      }
    });

    if (!agent) {
      throw new NotFoundException("Agent 不存在");
    }

    await this.ensureWorkspaceMember(agent.workspaceId, userId);

    if (dto.name === undefined && dto.providerConfig === undefined) {
      return this.toResponse(agent);
    }

    const nextProviderConfig = this.mergeProviderConfig(agent.providerConfigRef, dto.providerConfig);
    const updatedAgent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.providerConfig !== undefined
          ? { providerConfigRef: serializeAgentProviderConfig(nextProviderConfig) }
          : {})
      },
      select: {
        id: true,
        name: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true
      }
    });

    return this.toResponse(updatedAgent);
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

  private toResponse(agent: {
    id: string;
    name: string;
    engineType: string;
    isDefault: boolean;
    providerConfigRef: string | null;
  }) {
    return {
      id: agent.id,
      name: agent.name,
      engineType: agent.engineType,
      isDefault: agent.isDefault,
      providerConfig: summarizeAgentProviderConfig(parseAgentProviderConfigRef(agent.providerConfigRef))
    };
  }
}
