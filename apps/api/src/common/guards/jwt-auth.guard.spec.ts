import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  const prisma = {
    user: {
      findUnique: jest.fn()
    }
  };
  const jwtService = {
    verifyAsync: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("accepts a valid bearer token and attaches current user", async () => {
    const request: {
      headers: Record<string, string | undefined>;
      user?: unknown;
    } = {
      headers: {
        authorization: "Bearer valid-token"
      }
    };
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, JwtAuthGuard]
    }).compile();
    const guard = module.get(JwtAuthGuard);

    jwtService.verifyAsync.mockResolvedValue({
      sub: "user-1",
      email: "wade@example.com",
      role: UserRole.USER
    });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      passwordHash: "hashed",
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });
  });

  it("rejects requests without a bearer token", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, JwtAuthGuard]
    }).compile();
    const guard = module.get(JwtAuthGuard);

    await expect(guard.canActivate(createContext({
      headers: {}
    }))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createContext(request: { headers: Record<string, string | undefined>; user?: unknown }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as ExecutionContext;
}
