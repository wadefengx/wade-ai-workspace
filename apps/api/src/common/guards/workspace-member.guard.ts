import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { hasGlobalAdminRole } from "../auth/global-admin";
import { AuthenticatedUser } from "../types/authenticated-user";

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      params: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const workspaceId = request.params.workspaceId;

    if (!request.user) {
      throw new UnauthorizedException("未登录或登录已过期");
    }

    if (!workspaceId) {
      throw new NotFoundException("工作区不存在");
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      throw new NotFoundException("工作区不存在");
    }

    if (hasGlobalAdminRole(request.user.role)) {
      return true;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: request.user.id },
      select: { id: true }
    });

    if (!membership) {
      throw new ForbiddenException("无权访问该工作区");
    }

    return true;
  }
}
