import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AgentsService } from "./agents.service";

describe("AgentsService", () => {
  const prisma = {
    agent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
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

  it("maps provider config to baseUrl, model, and hasApiKey in list responses", async () => {
    prisma.agent.findMany.mockResolvedValue([{
      id: "agent-1",
      name: "Workspace AI",
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
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        baseUrl: "http://ollama.local/v1",
        model: "qwen3:8b",
        hasApiKey: true
      }
    }]);
  });

  it("merges provider config updates without overwriting apiKey with an empty value", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
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
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        baseUrl: "http://provider.old/v1",
        model: "qwen3:8b",
        hasApiKey: true
      }
    });
    expect(prisma.agent.update).toHaveBeenCalledWith({
      where: { id: "agent-1" },
      data: {
        name: "Workspace AI Plus",
        providerConfigRef: JSON.stringify({
          baseUrl: "http://provider.old/v1",
          apiKey: "saved-key",
          model: "qwen3:8b"
        })
      },
      select: {
        id: true,
        name: true,
        engineType: true,
        isDefault: true,
        providerConfigRef: true
      }
    });
  });

  it("rejects agent updates from non-members", async () => {
    prisma.agent.findUnique.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
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
      engineType: "default-chat",
      isDefault: true,
      providerConfigRef: null
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.agent.update.mockResolvedValue({
      id: "agent-1",
      name: "Workspace AI Admin",
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
      engineType: "default-chat",
      isDefault: true,
      providerConfig: {
        hasApiKey: false
      }
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
