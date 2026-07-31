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

export type ChannelAccess = {
  channelId: string;
  workspaceId: string;
};

export type ChannelAccessRequest = {
  params: Record<string, string | undefined>;
  user?: AuthenticatedUser;
  channelAccess?: ChannelAccess;
};

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ChannelAccessRequest>();
    const channelId = request.params.channelId;

    if (!request.user) {
      throw new UnauthorizedException("未登录或登录已过期");
    }

    if (!channelId) {
      throw new NotFoundException("频道不存在");
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        workspaceId: true
      }
    });

    if (!channel) {
      throw new NotFoundException("频道不存在");
    }

    request.channelAccess = {
      channelId: channel.id,
      workspaceId: channel.workspaceId
    };

    if (hasGlobalAdminRole(request.user.role)) {
      return true;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: channel.workspaceId,
        userId: request.user.id
      },
      select: { id: true }
    });

    if (!membership) {
      throw new ForbiddenException("无权访问该工作区");
    }

    return true;
  }
}

export function requireChannelAccess(request: ChannelAccessRequest) {
  if (!request.channelAccess) {
    throw new NotFoundException("频道不存在");
  }

  return request.channelAccess;
}
