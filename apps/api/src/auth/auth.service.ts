import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma, User, UserRole } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import {
  AuthenticatedUser,
  toAuthenticatedUser
} from "../common/types/authenticated-user";
import * as crypto from "node:crypto";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 30;
const REFRESH_TOKEN_EXPIRED_MESSAGE = "登录已过期,请重新登录";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ConflictException("该邮箱已被注册");
    }

    const passwordHash = await hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: UserRole.USER
        }
      });

      return this.buildAuthResponse(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("该邮箱已被注册");
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) {
      throw new UnauthorizedException("邮箱或密码错误");
    }

    const passwordMatched = await compare(dto.password, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException("邮箱或密码错误");
    }

    return this.buildAuthResponse(user);
  }

  async refresh(refreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: this.hashRefreshToken(refreshToken)
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException(REFRESH_TOKEN_EXPIRED_MESSAGE);
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });
      throw new UnauthorizedException(REFRESH_TOKEN_EXPIRED_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId }
    });

    if (!user) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id }
      });
      throw new UnauthorizedException(REFRESH_TOKEN_EXPIRED_MESSAGE);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refreshToken.delete({
        where: { id: storedToken.id }
      });

      return this.issueRefreshTokens(user, tx);
    });
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { userId }
    });

    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    const passwordMatched = await compare(dto.currentPassword, user.passwordHash);

    if (!passwordMatched) {
      throw new UnauthorizedException("当前密码错误");
    }

    const newPasswordHash = await hash(dto.newPassword, 10);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash
        }
      });

      await tx.refreshToken.deleteMany({
        where: { userId }
      });
    });

    return { ok: true };
  }

  private async buildAuthResponse(user: User) {
    const { accessToken, refreshToken } = await this.issueRefreshTokens(user, this.prisma);

    return {
      token: accessToken,
      accessToken,
      refreshToken,
      user: toAuthenticatedUser(user)
    };
  }

  private async issueRefreshTokens(user: User, prisma: Prisma.TransactionClient | PrismaService) {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = crypto.randomBytes(32).toString("hex");

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.buildRefreshTokenExpiry()
      }
    });

    return {
      accessToken,
      refreshToken
    };
  }

  private signAccessToken(user: User) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role
    }, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });
  }

  private hashRefreshToken(refreshToken: string) {
    return crypto.createHash("sha256").update(refreshToken).digest("hex");
  }

  private buildRefreshTokenExpiry() {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  }

  getCurrentUser(user: AuthenticatedUser) {
    return user;
  }
}
