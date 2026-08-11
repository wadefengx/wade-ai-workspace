import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MemoryLevel, MemoryType, UserRole, WorkspaceRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { EmbeddingService } from "../ai/embedding.service";
import { AI_PROVIDER } from "../ai/providers/ai-provider";
import { PrismaService } from "../prisma/prisma.service";
import { MemoryService } from "./memory.service";

describe("MemoryService", () => {
  const prisma = {
    memory: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    },
    channel: {
      findUnique: jest.fn(),
      findFirst: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
  });

  it("lists personal memories only for the current user plus shared team and project memories", async () => {
    prisma.memory.findMany.mockResolvedValue([{
      id: "memory-1",
      type: MemoryType.PERSONAL,
      content: "only me"
    }, {
      id: "memory-2",
      type: MemoryType.TEAM,
      content: "team"
    }, {
      id: "memory-3",
      type: MemoryType.PROJECT,
      content: "project"
    }]);

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.listVisibleMemories("workspace-1", "user-1")).resolves.toHaveLength(3);
    expect(prisma.memory.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        OR: [{
          type: MemoryType.PERSONAL,
          userId: "user-1"
        }, {
          type: {
            in: [MemoryType.TEAM, MemoryType.PROJECT]
          }
        }]
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });
  });

  it("stores the current user as the personal memory owner", async () => {
    prisma.memory.create.mockResolvedValue({
      id: "memory-1",
      workspaceId: "workspace-1",
      userId: "user-1",
      type: MemoryType.PERSONAL,
      content: "remember this",
      createdBy: "user-1",
      enabled: true
    });

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await service.createMemory("workspace-1", "user-1", {
      type: MemoryType.PERSONAL,
      content: "remember this"
    });

    expect(prisma.memory.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        type: MemoryType.PERSONAL,
        content: "remember this",
        level: MemoryLevel.L1_ATOM,
        userId: "user-1",
        createdBy: "user-1"
      }
    });
  });

  it("lets global admins read all workspace memories", async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: UserRole.ADMIN
    });
    prisma.memory.findMany.mockResolvedValue([{
      id: "memory-1",
      type: MemoryType.PERSONAL,
      content: "alice only"
    }, {
      id: "memory-2",
      type: MemoryType.TEAM,
      content: "team"
    }]);
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.listVisibleMemories("workspace-1", "admin-1")).resolves.toHaveLength(2);
    expect(prisma.memory.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1"
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });
  });

  it("allows workspace owners to edit other members' memories", async () => {
    prisma.memory.findUnique.mockResolvedValue({
      id: "memory-1",
      workspaceId: "workspace-1",
      createdBy: "user-2"
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: WorkspaceRole.OWNER
    });
    prisma.memory.update.mockResolvedValue({
      id: "memory-1",
      content: "updated",
      enabled: false
    });

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.updateMemory("memory-1", "owner-1", {
      content: "updated",
      enabled: false
    })).resolves.toEqual({
      id: "memory-1",
      content: "updated",
      enabled: false
    });
  });

  it("blocks non-owners from deleting another member's memory", async () => {
    prisma.memory.findUnique.mockResolvedValue({
      id: "memory-1",
      workspaceId: "workspace-1",
      createdBy: "user-2"
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      role: WorkspaceRole.MEMBER
    });

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.deleteMemory("memory-1", "user-3")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.memory.delete).not.toHaveBeenCalled();
  });

  it("requires at least one mutable field on update", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn().mockResolvedValue([0.1, 0.2]) }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn().mockReturnValue([{ type: "token", content: "{}" }]) }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.updateMemory("memory-1", "user-1", {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it("scopes channel lookup to the authorized workspace before extraction", async () => {
    prisma.channel.findFirst.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: { embed: jest.fn() }
      }, {
        provide: AI_PROVIDER,
        useValue: { stream: jest.fn() }
      }, MemoryService]
    }).compile();
    const service = module.get(MemoryService);

    await expect(service.extractFromConversation("workspace-1", "channel-other", "user-1"))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.channel.findFirst).toHaveBeenCalledWith({
      where: {
        id: "channel-other",
        workspaceId: "workspace-1"
      },
      select: {
        id: true,
        workspaceId: true
      }
    });
  });
});
