import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { UserRole, WorkspaceRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
  const prisma = {
    workspace: {
      findMany: jest.fn(),
      findUnique: jest.fn()
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
      create: jest.fn()
    },
    $transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it("creates workspace with owner membership and default general channel", async () => {
    const tx = {
      workspace: {
        create: jest.fn().mockResolvedValue({
          id: "workspace-1",
          name: "Core Team",
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

    await expect(service.createWorkspace("user-1", { name: "Core Team" })).resolves.toEqual({
      id: "workspace-1",
      name: "Core Team",
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

  it("returns all workspaces for global admins", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.workspace.findMany.mockResolvedValue([{
      id: "workspace-1",
      name: "Team Alpha"
    }, {
      id: "workspace-2",
      name: "Demo Workspace"
    }]);
    const service = await createService();

    await expect(service.listForUser("admin-1")).resolves.toEqual([{
      id: "workspace-1",
      name: "Team Alpha"
    }, {
      id: "workspace-2",
      name: "Demo Workspace"
    }]);
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" }
    });
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
