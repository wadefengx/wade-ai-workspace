import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { compare, hash } from "bcryptjs";
import * as crypto from "node:crypto";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const DEFAULT_REFRESH_TOKEN = "aa".repeat(32);

describe("AuthService", () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    $transaction: jest.fn()
  };
  const jwtService = {
    signAsync: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    prisma.$transaction.mockImplementation(async (callback: (client: typeof prisma) => Promise<unknown>) => callback(prisma));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.refreshToken.create.mockResolvedValue(undefined);
    prisma.refreshToken.delete.mockResolvedValue(undefined);
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    jwtService.signAsync.mockResolvedValue("signed-access-token");
    mockRandomBytes(DEFAULT_REFRESH_TOKEN);
  });

  it("registers a user and returns access and refresh tokens with safe user data", async () => {
    const service = await createService();

    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: { name: string; email: string; passwordHash: string } }) => ({
      ...buildUser({
        name: data.name,
        email: data.email
      }),
      passwordHash: data.passwordHash
    }));

    const result = await service.register({
      name: "Wade",
      email: "wade@example.com",
      password: "password123"
    });

    const createCall = prisma.user.create.mock.calls[0][0] as {
      data: { passwordHash: string };
    };
    const refreshTokenCall = prisma.refreshToken.create.mock.calls[0][0] as {
      data: { tokenHash: string; expiresAt: Date; userId: string };
    };

    await expect(compare("password123", createCall.data.passwordHash)).resolves.toBe(true);
    expect(result).toEqual({
      token: "signed-access-token",
      accessToken: "signed-access-token",
      refreshToken: DEFAULT_REFRESH_TOKEN,
      user: buildSafeUser()
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: "user-1",
      email: "wade@example.com",
      role: UserRole.USER
    }, {
      expiresIn: "15m"
    });
    expect(refreshTokenCall.data).toMatchObject({
      userId: "user-1",
      tokenHash: hashRefreshToken(DEFAULT_REFRESH_TOKEN)
    });
    expect(refreshTokenCall.data.expiresAt).toBeInstanceOf(Date);
  });

  it("rejects duplicate email on register", async () => {
    const service = await createService();

    prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash: "hashed" }));

    await expect(service.register({
      name: "Wade",
      email: "wade@example.com",
      password: "password123"
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with correct credentials and returns dual tokens", async () => {
    const service = await createService();
    const passwordHash = await hash("password123", 10);

    prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

    await expect(service.login({
      email: "wade@example.com",
      password: "password123"
    })).resolves.toEqual({
      token: "signed-access-token",
      accessToken: "signed-access-token",
      refreshToken: DEFAULT_REFRESH_TOKEN,
      user: buildSafeUser()
    });
  });

  it("rejects login with wrong password", async () => {
    const service = await createService();

    prisma.user.findUnique.mockResolvedValue(buildUser({
      passwordHash: await hash("another-password", 10)
    }));

    await expect(service.login({
      email: "wade@example.com",
      password: "password123"
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rotates refresh tokens", async () => {
    const service = await createService();
    const oldRefreshToken = "11".repeat(32);
    const newRefreshToken = "bb".repeat(32);

    mockRandomBytes(newRefreshToken);
    jwtService.signAsync.mockResolvedValueOnce("rotated-access-token");
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tokenHash: hashRefreshToken(oldRefreshToken),
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z")
    });
    prisma.user.findUnique.mockResolvedValue(buildUser({
      passwordHash: await hash("password123", 10)
    }));

    await expect(service.refresh(oldRefreshToken)).resolves.toEqual({
      accessToken: "rotated-access-token",
      refreshToken: newRefreshToken
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: {
        tokenHash: hashRefreshToken(oldRefreshToken)
      }
    });
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
      where: { id: "refresh-1" }
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        tokenHash: hashRefreshToken(newRefreshToken),
        expiresAt: expect.any(Date)
      }
    });
  });

  it("rejects expired refresh tokens with 401", async () => {
    const service = await createService();
    const expiredRefreshToken = "22".repeat(32);

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "refresh-1",
      userId: "user-1",
      tokenHash: hashRefreshToken(expiredRefreshToken),
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
      createdAt: new Date("2023-12-01T00:00:00.000Z")
    });

    await expect(service.refresh(expiredRefreshToken)).rejects.toThrow("登录已过期,请重新登录");
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
      where: { id: "refresh-1" }
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("deletes all refresh tokens on logout", async () => {
    const service = await createService();

    await expect(service.logout("user-1")).resolves.toEqual({
      ok: true
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
  });

  it("changes password after verifying the current password and revokes refresh tokens", async () => {
    const service = await createService();
    const currentPasswordHash = await hash("password123", 10);

    prisma.user.findUnique.mockResolvedValue(buildUser({
      passwordHash: currentPasswordHash
    }));
    prisma.user.update.mockResolvedValue(undefined);

    await expect(service.changePassword("user-1", {
      currentPassword: "password123",
      newPassword: "new-password"
    })).resolves.toEqual({
      ok: true
    });

    const updateCall = prisma.user.update.mock.calls[0][0] as {
      data: { passwordHash: string };
    };

    await expect(compare("new-password", updateCall.data.passwordHash)).resolves.toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" }
    });
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: JwtService,
        useValue: jwtService
      }, AuthService]
    }).compile();

    return module.get(AuthService);
  }

  function buildUser(overrides: Partial<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}) {
    return {
      id: "user-1",
      name: "Wade",
      email: "wade@example.com",
      passwordHash: "hashed-password",
      role: UserRole.USER,
      avatarUrl: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      ...overrides
    };
  }

  function buildSafeUser() {
    const { passwordHash, ...user } = buildUser();
    void passwordHash;
    return user;
  }

  function hashRefreshToken(refreshToken: string) {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  function mockRandomBytes(refreshToken: string) {
    jest.spyOn(crypto, "randomBytes").mockImplementation(((size: number) => {
      expect(size).toBe(32);
      return Buffer.from(refreshToken, "hex");
    }) as unknown as typeof crypto.randomBytes);
  }
});
