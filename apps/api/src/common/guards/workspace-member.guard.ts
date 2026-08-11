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
      throw new UnauthorizedException("Not signed in or session has expired");
    }

    if (!workspaceId) {
      throw new NotFoundException("Workspace not found");
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    if (hasGlobalAdminRole(request.user.role)) {
      return true;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: request.user.id },
      select: { id: true }
    });

    if (!membership) {
      throw new ForbiddenException("You do not have access to this workspace");
    }

    return true;
  }
}
