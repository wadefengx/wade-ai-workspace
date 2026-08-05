import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgentType, UserRole, WorkspaceRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AgentsService } from "./agents.service";

describe("AgentsService", () => {
  const prisma = {
    agent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it("maps type and provider config in list responses", async () => {
    prisma.agent.findMany.mockResolvedValue([{
      id: "agent-1",
      name: "Workspace AI",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: JSON.stringify({
        baseUrl: "http://ollama.local/v1",
        apiKey: "secret-key",
        model: "qwen3:8b"
      })
    }]);
    const service = await createService();

    await expect(service.listWorkspaceAgents("workspace-1")).resolves.toEqual([{
      id: "agent-1",
      name: "Workspace AI",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        baseUrl: "http://ollama.local/v1",
        model: "qwen3:8b",
        hasApiKey: true
      },
      emoji: null,
      role: null,
      description: null,
      systemPrompt: null,
      harness: "OLLAMA"
    }]);
  });

  it("creates typed agents for workspace managers", async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.ADMIN });
    prisma.agent.create.mockResolvedValue({
      id: "agent-2",
      name: "Claude Agent",
      type: AgentType.ANTHROPIC,
      engineType: "default-chat",
      isDefault: false,
      providerConfigRef: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        apiKey: "secret"
      })
    });
    const service = await createService();

    await expect(service.createAgent("workspace-1", "admin-1", {
      name: "Claude Agent",
      type: AgentType.ANTHROPIC,
      providerConfig: {
        model: "claude-3-5-sonnet-latest",
        apiKey: "secret"
      }
    })).resolves.toEqual({
      id: "agent-2",
      name: "Claude Agent",
      type: AgentType.ANTHROPIC,
      engineType: "default-chat",
      isDefault: false,
      providerConfig: {
        model: "claude-3-5-sonnet-latest",
        hasApiKey: true
      },
      emoji: null,
      role: null,
      description: null,
      systemPrompt: null,
      harness: "OLLAMA"
    });
  });

  it("merges provider config updates without overwriting apiKey with an empty value", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: JSON.stringify({
        baseUrl: "http://provider.old/v1",
        apiKey: "saved-key",
        model: "qwen2.5:7b"
      })
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.agent.update.mockResolvedValue({
      id: "agent-1",
      name: "Workspace AI Plus",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: JSON.stringify({
        baseUrl: "http://provider.old/v1",
        apiKey: "saved-key",
        model: "qwen3:8b"
      })
    });
    const service = await createService();

    await expect(service.updateAgent("agent-1", "user-1", {
      name: "Workspace AI Plus",
      providerConfig: {
        model: "qwen3:8b",
        apiKey: ""
      }
    })).resolves.toEqual({
      id: "agent-1",
      name: "Workspace AI Plus",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        baseUrl: "http://provider.old/v1",
        model: "qwen3:8b",
        hasApiKey: true
      },
      emoji: null,
      role: null,
      description: null,
      systemPrompt: null,
      harness: "OLLAMA"
    });
  });

  it("rejects agent updates from non-members", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      type: AgentType.OLLAMA,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: null
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    const service = await createService();

    await expect(service.updateAgent("agent-1", "user-2", {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows global admins to update agents without workspace membership", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      type: AgentType.OLLAMA,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: null
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.agent.update.mockResolvedValue({
      id: "agent-1",
      name: "Workspace AI Admin",
      type: AgentType.OLLAMA,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: null
    });
    const service = await createService();

    await expect(service.updateAgent("agent-1", "admin-1", {
      name: "Workspace AI Admin"
    })).resolves.toEqual({
      id: "agent-1",
      name: "Workspace AI Admin",
      type: AgentType.OLLAMA,
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        hasApiKey: false
      },
      emoji: null,
      role: null,
      description: null,
      systemPrompt: null,
      harness: "OLLAMA"
    });
  });

  it("returns the current agent when the patch is empty", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: JSON.stringify({
        baseUrl: "http://provider.old/v1",
        model: "qwen3:8b"
      })
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
    const service = await createService();

    await expect(service.updateAgent("agent-1", "user-1", {})).resolves.toEqual({
      id: "agent-1",
      name: "Workspace AI",
      type: AgentType.OPENAI_COMPATIBLE,
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        baseUrl: "http://provider.old/v1",
        model: "qwen3:8b",
        hasApiKey: false
      },
      emoji: null,
      role: null,
      description: null,
      systemPrompt: null,
      harness: "OLLAMA"
    });
    expect(prisma.agent.update).not.toHaveBeenCalled();
  });

  it("rejects deleting the default agent", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      isDefault: true
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.OWNER });
    const service = await createService();

    await expect(service.deleteAgent("agent-1", "owner-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deletes non-default agents for workspace managers", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-2",
      workspaceId: "workspace-1",
      isDefault: false
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.ADMIN });
    prisma.agent.delete.mockResolvedValue(undefined);
    const service = await createService();

    await expect(service.deleteAgent("agent-2", "admin-1")).resolves.toEqual({
      id: "agent-2"
    });
    expect(prisma.agent.delete).toHaveBeenCalledWith({
      where: { id: "agent-2" }
    });
  });

  it("fails when the target agent does not exist", async () => {
    prisma.agent.findUnique.mockResolvedValue(null);
    const service = await createService();

    await expect(service.updateAgent("agent-missing", "user-1", {})).rejects.toBeInstanceOf(NotFoundException);
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, AgentsService]
    }).compile();

    return module.get(AgentsService);
  }
});
