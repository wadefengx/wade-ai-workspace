import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { UserRole, WorkspaceRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { unlink } from "node:fs/promises";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { WorkspaceService } from "./workspace.service";

jest.mock("node:fs/promises", () => ({
  unlink: jest.fn()
}));

describe("WorkspaceService", () => {
  const unlinkMock = jest.mocked(unlink);
  const prisma = {
    workspace: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    channel: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn()
    },
    message: {
      deleteMany: jest.fn(),
      groupBy: jest.fn()
    },
    knowledgeDocument: {
      findMany: jest.fn(),
      deleteMany: jest.fn()
    },
    knowledgeChunk: {
      deleteMany: jest.fn()
    },
    memory: {
      deleteMany: jest.fn()
    },
    agent: {
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    unlinkMock.mockResolvedValue(undefined);
  });

  it("creates workspace with owner membership and default general channel", async () => {
    const tx = {
      workspace: {
        create: jest.fn().mockResolvedValue({
          id: "workspace-1",
          name: "Core Team",
          icon: "RocketOutlined",
          createdById: "user-1",
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z")
        })
      },
      workspaceMember: {
        create: jest.fn().mockResolvedValue(undefined)
      },
      channel: {
        create: jest.fn().mockResolvedValue(undefined)
      }
    };
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceService]
    }).compile();
    const service = module.get(WorkspaceService);

    await expect(service.createWorkspace("user-1", {
      name: "Core Team",
      icon: "RocketOutlined"
    })).resolves.toEqual({
      id: "workspace-1",
      name: "Core Team",
      icon: "RocketOutlined",
      createdById: "user-1",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        userId: "user-1",
        role: WorkspaceRole.OWNER
      }
    });
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: {
        name: "Core Team",
        icon: "RocketOutlined",
        createdById: "user-1"
      }
    });
    expect(tx.channel.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        name: "general"
      }
    });
  });

  it("blocks non-members from reading workspace channels", async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceService]
    }).compile();
    const service = module.get(WorkspaceService);

    await expect(service.listChannels("workspace-1", "user-2")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.channel.findMany).not.toHaveBeenCalled();
  });

  it("returns channels with lastMessageAt and messageCount", async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
    prisma.channel.findMany.mockResolvedValue([{
      id: "channel-1",
      workspaceId: "workspace-1",
      name: "general",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    }, {
      id: "channel-2",
      workspaceId: "workspace-1",
      name: "random",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z")
    }]);
    prisma.message.groupBy.mockResolvedValue([{
      channelId: "channel-1",
      _count: { _all: 3 },
      _max: {
        createdAt: new Date("2024-01-03T00:00:00.000Z")
      }
    }]);
    const service = await createService();

    await expect(service.listChannels("workspace-1", "user-1")).resolves.toEqual([{
      id: "channel-1",
      workspaceId: "workspace-1",
      name: "general",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      lastMessageAt: new Date("2024-01-03T00:00:00.000Z"),
      messageCount: 3
    }, {
      id: "channel-2",
      workspaceId: "workspace-1",
      name: "random",
      createdAt: new Date("2024-01-02T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
      lastMessageAt: null,
      messageCount: 0
    }]);
    expect(prisma.message.groupBy).toHaveBeenCalledWith({
      by: ["channelId"],
      where: {
        workspaceId: "workspace-1",
        channelId: {
          in: ["channel-1", "channel-2"]
        }
      },
      _count: {
        _all: true
      },
      _max: {
        createdAt: true
      }
    });
  });

  it("returns all workspaces for global admins", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.workspace.findMany.mockResolvedValue([{
      id: "workspace-1",
      name: "Team Alpha",
      icon: "TeamOutlined"
    }, {
      id: "workspace-2",
      name: "Demo Workspace",
      icon: "RocketOutlined"
    }]);
    const service = await createService();

    await expect(service.listForUser("admin-1")).resolves.toEqual([{
      id: "workspace-1",
      name: "Team Alpha",
      icon: "TeamOutlined"
    }, {
      id: "workspace-2",
      name: "Demo Workspace",
      icon: "RocketOutlined"
    }]);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" }
    });
  });

  it("validates optional workspace icon on create dto", async () => {
    const invalidDto = plainToInstance(CreateWorkspaceDto, {
      name: "Team Alpha",
      icon: "x".repeat(51)
    });
    const invalidResults = await validate(invalidDto);

    expect(invalidResults).toHaveLength(1);
    expect(invalidResults[0]?.constraints).toMatchObject({
      maxLength: "工作区图标长度不能超过50个字符"
    });

    const validDto = plainToInstance(CreateWorkspaceDto, {
      name: "Team Alpha",
      icon: "TeamOutlined"
    });
    await expect(validate(validDto)).resolves.toEqual([]);
  });

  it("allows global admins to list members without workspace membership", async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.workspaceMember.findMany.mockResolvedValue([{
      id: "member-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      role: WorkspaceRole.OWNER,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@wade.local",
        avatarUrl: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      }
    }]);
    const service = await createService();

    await expect(service.listMembers("workspace-1", "admin-1")).resolves.toEqual([{
      id: "member-1",
      userId: "user-1",
      role: WorkspaceRole.OWNER,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      name: "Alice",
      email: "alice@wade.local",
      avatarUrl: null
    }]);
  });

  it("rejects adding a member when the email has not been registered", async () => {
    prisma.workspaceMember.findFirst.mockResolvedValueOnce({
      role: WorkspaceRole.OWNER
    });
    prisma.user.findUnique.mockResolvedValue(null);
    const service = await createService();

    await expect(service.addMember("workspace-1", "owner-1", {
      email: "missing@example.com"
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects adding an existing workspace member", async () => {
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ role: WorkspaceRole.ADMIN })
      .mockResolvedValueOnce({ id: "member-2" });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      name: "Bob",
      email: "bob@example.com"
    });
    const service = await createService();

    await expect(service.addMember("workspace-1", "admin-1", {
      email: "bob@example.com",
      role: WorkspaceRole.MEMBER
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects granting the owner role directly", async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.OWNER
    });
    const service = await createService();

    await expect(service.addMember("workspace-1", "owner-1", {
      email: "bob@example.com",
      role: WorkspaceRole.OWNER
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects member additions from ordinary members", async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.MEMBER
    });
    const service = await createService();

    await expect(service.addMember("workspace-1", "member-1", {
      email: "bob@example.com"
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects role changes targeting an owner", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: "member-1",
      workspaceId: "workspace-1",
      userId: "owner-2",
      role: WorkspaceRole.OWNER
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.OWNER
    });
    const service = await createService();

    await expect(service.updateMemberRole("member-1", "owner-1", {
      role: WorkspaceRole.ADMIN
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
  });

  it("rejects role changes from ordinary members", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: "member-1",
      workspaceId: "workspace-1",
      userId: "member-2",
      role: WorkspaceRole.MEMBER
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.MEMBER
    });
    const service = await createService();

    await expect(service.updateMemberRole("member-1", "member-1", {
      role: WorkspaceRole.ADMIN
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects removing an owner", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: "member-1",
      workspaceId: "workspace-1",
      userId: "owner-2",
      role: WorkspaceRole.OWNER
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.ADMIN
    });
    const service = await createService();

    await expect(service.removeMember("member-1", "admin-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
  });

  it("rejects removals from ordinary members", async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: "member-1",
      workspaceId: "workspace-1",
      userId: "member-2",
      role: WorkspaceRole.MEMBER
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      role: WorkspaceRole.MEMBER
    });
    const service = await createService();

    await expect(service.removeMember("member-1", "member-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("transfers ownership in one transaction", async () => {
    const tx = {
      workspaceMember: {
        update: jest.fn().mockResolvedValue(undefined)
      },
      workspace: {
        update: jest.fn().mockResolvedValue(undefined)
      }
    };
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ role: WorkspaceRole.OWNER })
      .mockResolvedValueOnce({ id: "owner-member", userId: "owner-1" })
      .mockResolvedValueOnce({ id: "target-member", userId: "user-2", role: WorkspaceRole.ADMIN });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const service = await createService();

    await expect(service.transferOwnership("workspace-1", "owner-1", {
      toUserId: "user-2"
    })).resolves.toEqual({
      id: "workspace-1"
    });
    expect(tx.workspaceMember.update).toHaveBeenNthCalledWith(1, {
      where: { id: "owner-member" },
      data: { role: WorkspaceRole.ADMIN }
    });
    expect(tx.workspaceMember.update).toHaveBeenNthCalledWith(2, {
      where: { id: "target-member" },
      data: { role: WorkspaceRole.OWNER }
    });
    expect(tx.workspace.update).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
      data: { createdById: "user-2" }
    });
  });

  it("rejects transferring ownership to a non-member", async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ role: WorkspaceRole.OWNER })
      .mockResolvedValueOnce({ id: "owner-member", userId: "owner-1" })
      .mockResolvedValueOnce(null);
    const service = await createService();

    await expect(service.transferOwnership("workspace-1", "owner-1", {
      toUserId: "user-2"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects transferring ownership to the current owner", async () => {
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst
      .mockResolvedValueOnce({ role: WorkspaceRole.OWNER })
      .mockResolvedValueOnce({ id: "owner-member", userId: "owner-1" })
      .mockResolvedValueOnce({ id: "owner-member", userId: "owner-1", role: WorkspaceRole.OWNER });
    const service = await createService();

    await expect(service.transferOwnership("workspace-1", "owner-1", {
      toUserId: "owner-1"
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes workspace resources in one transaction", async () => {
    const tx = {
      message: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      channel: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      workspaceMember: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      knowledgeChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      knowledgeDocument: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      memory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      agent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      workspace: {
        delete: jest.fn().mockResolvedValue(undefined)
      }
    };
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.OWNER });
    prisma.knowledgeDocument.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const service = await createService();

    await expect(service.deleteWorkspace("workspace-1", "owner-1")).resolves.toEqual({
      id: "workspace-1"
    });
    expect(tx.message.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: "workspace-1" }
    });
    expect(tx.workspace.delete).toHaveBeenCalledWith({
      where: { id: "workspace-1" }
    });
  });

  it("removes stored knowledge files after deleting a workspace", async () => {
    const tx = {
      message: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      channel: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      workspaceMember: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      knowledgeChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      knowledgeDocument: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      memory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      agent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      workspace: {
        delete: jest.fn().mockResolvedValue(undefined)
      }
    };
    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.OWNER });
    prisma.knowledgeDocument.findMany.mockResolvedValue([
      { storageKey: "docs/a.md" },
      { storageKey: "docs/b.pdf" }
    ]);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
    const service = await createService();

    await expect(service.deleteWorkspace("workspace-1", "owner-1")).resolves.toEqual({
      id: "workspace-1"
    });
    expect(unlinkMock).toHaveBeenCalledTimes(2);
    expect(unlinkMock).toHaveBeenCalledWith("/app/uploads/docs/a.md");
    expect(unlinkMock).toHaveBeenCalledWith("/app/uploads/docs/b.pdf");
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceService]
    }).compile();

    return module.get(WorkspaceService);
  }
});
