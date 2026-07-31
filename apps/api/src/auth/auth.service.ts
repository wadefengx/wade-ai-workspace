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

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(dto.newPassword, 10)
      }
    });

    return { ok: true };
  }

  private async buildAuthResponse(user: User) {
    return {
      token: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role
      }),
      user: toAuthenticatedUser(user)
    };
  }

  getCurrentUser(user: AuthenticatedUser) {
    return user;
  }
}
