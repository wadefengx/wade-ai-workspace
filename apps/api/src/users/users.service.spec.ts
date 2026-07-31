import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    workspace: {
      findFirst: jest.fn()
    },
    workspaceMember: {
      deleteMany: jest.fn()
    },
    memory: {
      updateMany: jest.fn()
    },
    $transaction: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.ADMIN });
    prisma.user.count.mockResolvedValue(2);
    prisma.workspace.findFirst.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it("lists all users for global admins when q is empty", async () => {
    prisma.user.findMany.mockResolvedValue([{
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: UserRole.USER,
      createdAt: new Date("2024-01-01T00:00:00.000Z")
    }]);
    const service = await createService();

    await expect(service.listUsers("admin-1", "   ")).resolves.toEqual([{
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: UserRole.USER,
      createdAt: new Date("2024-01-01T00:00:00.000Z")
    }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  });

  it("filters users by name or email for global admins", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const service = await createService();

    await service.listUsers("admin-1", " ali ");
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{
          email: {
            contains: "ali",
            mode: "insensitive"
          }
        }, {
          name: {
            contains: "ali",
            mode: "insensitive"
          }
        }]
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  });

  it("rejects list access from non-admins", async () => {
    prisma.user.findUnique.mockResolvedValue({ role: UserRole.USER });
    const service = await createService();

    await expect(service.listUsers("user-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks changing your own global role", async () => {
    const service = await createService();

    await expect(service.updateUserRole("admin-1", "admin-1", {
      role: UserRole.USER
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects demoting the only global admin", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ role: UserRole.ADMIN })
      .mockResolvedValueOnce({
        id: "admin-2",
        name: "Admin",
        email: "admin-2@example.com",
        role: UserRole.ADMIN,
        createdAt: new Date("2024-01-01T00:00:00.000Z")
      });
    prisma.user.count.mockResolvedValue(1);
    const service = await createService();

    await expect(service.updateUserRole("admin-1", "admin-2", {
      role: UserRole.USER
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deletes workspace memberships before deleting a user", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ role: UserRole.ADMIN })
      .mockResolvedValueOnce({
        id: "user-2",
        role: UserRole.USER
      });
    prisma.user.delete.mockResolvedValue(undefined);
    prisma.workspaceMember.deleteMany.mockResolvedValue({ count: 1 });
    prisma.memory.updateMany.mockResolvedValue({ count: 0 });
    const service = await createService();

    await expect(service.removeUser("admin-1", "user-2")).resolves.toEqual({
      id: "user-2"
    });
    expect(prisma.workspaceMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-2" }
    });
    expect(prisma.memory.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-2" },
      data: { userId: null }
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-2" }
    });
  });

  it("rejects deleting the only global admin", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ role: UserRole.ADMIN })
      .mockResolvedValueOnce({
        id: "admin-2",
        role: UserRole.ADMIN
      });
    prisma.user.count.mockResolvedValue(1);
    const service = await createService();

    await expect(service.removeUser("admin-1", "admin-2")).rejects.toBeInstanceOf(BadRequestException);
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, UsersService]
    }).compile();

    return module.get(UsersService);
  }
});
