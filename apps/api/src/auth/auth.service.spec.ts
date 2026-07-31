import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { compare, hash } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn()
    }
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("signed-token")
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers a user and returns token with safe user data", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, AuthService]
    }).compile();
    const service = module.get(AuthService);

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: { name: string; email: string; passwordHash: string } }) => ({
      id: "user-1",
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    }));

    const result = await service.register({
      name: "Wade",
      email: "wade@example.com",
      password: "password123"
    });

    const createCall = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };

    await expect(compare("password123", createCall.data.passwordHash)).resolves.toBe(true);
    expect(result).toEqual({
      token: "signed-token",
      user: {
        id: "user-1",
        name: "Wade",
        email: "wade@example.com",
        role: UserRole.USER,
        avatarUrl: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      }
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: "user-1",
      email: "wade@example.com",
      role: UserRole.USER
    });
  });

  it("rejects duplicate email on register", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, AuthService]
    }).compile();
    const service = module.get(AuthService);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      passwordHash: "hashed",
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(service.register({
      name: "Wade",
      email: "wade@example.com",
      password: "password123"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with correct credentials", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, AuthService]
    }).compile();
    const service = module.get(AuthService);
    const passwordHash = await hash("password123", 10);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      passwordHash,
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });

    await expect(service.login({
      email: "wade@example.com",
      password: "password123"
    })).resolves.toEqual({
      token: "signed-token",
      user: {
        id: "user-1",
        name: "Wade",
        email: "wade@example.com",
        role: UserRole.USER,
        avatarUrl: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      }
    });
  });

  it("rejects login with wrong password", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, AuthService]
    }).compile();
    const service = module.get(AuthService);

    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      passwordHash: await hash("another-password", 10),
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(service.login({
      email: "wade@example.com",
      password: "password123"
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
