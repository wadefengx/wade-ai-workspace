import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser, toAuthenticatedUser } from "../types/authenticated-user";

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("未登录或登录已过期");
    }

    const payload = await this.verifyToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException("未登录或登录已过期");
    }

    request.user = toAuthenticatedUser(user);

    return true;
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private async verifyToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("未登录或登录已过期");
    }
  }
}
