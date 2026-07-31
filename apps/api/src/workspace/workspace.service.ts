import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, WorkspaceRole } from "@prisma/client";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { TransferWorkspaceDto } from "./dto/transfer-workspace.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

const DEFAULT_UPLOAD_DIR = "/app/uploads";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    if (await isGlobalAdmin(this.prisma, userId)) {
      return this.prisma.workspace.findMany({
        orderBy: { createdAt: "asc" }
      });
    }

    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: { userId }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          icon: dto.icon,
          createdById: userId
        }
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER
        }
      });

      await tx.channel.create({
        data: {
          workspaceId: workspace.id,
          name: "general"
        }
      });

      return workspace;
    });
  }

  async updateWorkspace(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.ensureOwnerOrGlobalAdmin(workspaceId, userId);

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
        icon: dto.icon
      },
      select: {
        id: true,
        name: true,
        icon: true,
        createdById: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async transferOwnership(workspaceId: string, userId: string, dto: TransferWorkspaceDto) {
    await this.ensureOwnerOrGlobalAdmin(workspaceId, userId);

    const [currentOwner, targetMembership] = await Promise.all([
      this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          role: WorkspaceRole.OWNER
        },
        select: {
          id: true,
          userId: true
        }
      }),
      this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: dto.toUserId
        },
        select: {
          id: true,
          userId: true,
          role: true
        }
      })
    ]);

    if (!currentOwner) {
      throw new NotFoundException("工作区 OWNER 不存在");
    }

    if (!targetMembership) {
      throw new BadRequestException("目标用户不是工作区成员");
    }

    if (targetMembership.userId === currentOwner.userId) {
      throw new BadRequestException("不能转交给当前 OWNER");
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.workspaceMember.update({
        where: { id: currentOwner.id },
        data: { role: WorkspaceRole.ADMIN }
      });
      await tx.workspaceMember.update({
        where: { id: targetMembership.id },
        data: { role: WorkspaceRole.OWNER }
      });
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { createdById: targetMembership.userId }
      });
    });

    return { id: workspaceId };
  }

  async deleteWorkspace(workspaceId: string, userId: string) {
    await this.ensureOwnerOrGlobalAdmin(workspaceId, userId);

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: { workspaceId },
      select: { storageKey: true }
    });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.message.deleteMany({
        where: { workspaceId }
      });
      await tx.channel.deleteMany({
        where: { workspaceId }
      });
      await tx.workspaceMember.deleteMany({
        where: { workspaceId }
      });
      await tx.knowledgeChunk.deleteMany({
        where: { workspaceId }
      });
      await tx.knowledgeDocument.deleteMany({
        where: { workspaceId }
      });
      await tx.memory.deleteMany({
        where: { workspaceId }
      });
      await tx.agent.deleteMany({
        where: { workspaceId }
      });
      await tx.workspace.delete({
        where: { id: workspaceId }
      });
    });

    await Promise.all(documents.map((document) => this.deleteStoredFile(document.storageKey)));

    return { id: workspaceId };
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.ensureWorkspaceMember(workspaceId, userId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    return members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      name: member.user.name,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl
    }));
  }

  async addMember(workspaceId: string, operatorId: string, dto: CreateMemberDto) {
    await this.ensureManager(workspaceId, operatorId);

    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException("不能直接授予 OWNER 角色");
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true }
    });

    if (!targetUser) {
      throw new NotFoundException("该邮箱尚未注册");
    }

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUser.id },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException("该用户已是工作区成员");
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: dto.role ?? WorkspaceRole.MEMBER
      },
      select: { id: true, userId: true, role: true, createdAt: true }
    });
  }

  async updateMemberRole(memberId: string, operatorId: string, dto: UpdateMemberRoleDto) {
    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException("不能直接授予 OWNER 角色");
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      select: { id: true, workspaceId: true, userId: true, role: true }
    });

    if (!membership) {
      throw new NotFoundException("成员不存在");
    }

    await this.ensureManager(membership.workspaceId, operatorId);

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("不能修改 OWNER 的角色");
    }

    if (membership.userId === operatorId && dto.role !== WorkspaceRole.ADMIN) {
      throw new BadRequestException("管理员不能降级自己，请让其他管理员操作");
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      select: { id: true, userId: true, role: true }
    });
  }

  async removeMember(memberId: string, operatorId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      select: { id: true, workspaceId: true, userId: true, role: true }
    });

    if (!membership) {
      throw new NotFoundException("成员不存在");
    }

    await this.ensureManager(membership.workspaceId, operatorId);

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("不能移除工作区 OWNER");
    }

    // OWNER 不可被移除/降级,ownerCount 恒 ≥1,无需额外校验

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });

    return { id: memberId };
  }

  private async ensureManager(workspaceId: string, userId: string) {
    await this.ensureWorkspaceExists(workspaceId);

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true }
    });

    if (!membership || membership.role === WorkspaceRole.MEMBER) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return;
      }

      if (!membership) {
        throw new ForbiddenException("无权访问该工作区");
      }

      throw new ForbiddenException("仅 OWNER 或 ADMIN 可执行该操作");
    }
  }

  private async ensureOwnerOrGlobalAdmin(workspaceId: string, userId: string) {
    await this.ensureWorkspaceExists(workspaceId);

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true }
    });

    if (membership?.role === WorkspaceRole.OWNER) {
      return;
    }

    if (await isGlobalAdmin(this.prisma, userId)) {
      return;
    }

    if (!membership) {
      throw new ForbiddenException("无权访问该工作区");
    }

    throw new ForbiddenException("仅 OWNER 可执行该操作");
  }

  async listChannels(workspaceId: string, userId: string) {
    await this.ensureWorkspaceMember(workspaceId, userId);

    const channels = await this.prisma.channel.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" }
    });

    if (channels.length === 0) {
      return [];
    }

    const messageStats = await this.prisma.message.groupBy({
      by: ["channelId"],
      where: {
        workspaceId,
        channelId: {
          in: channels.map((channel) => channel.id)
        }
      },
      _count: {
        _all: true
      },
      _max: {
        createdAt: true
      }
    });

    const statsByChannelId = new Map(messageStats.map((item) => [item.channelId, item]));

    return channels.map((channel) => {
      const stats = statsByChannelId.get(channel.id);

      return {
        ...channel,
        lastMessageAt: stats?._max.createdAt ?? null,
        messageCount: stats?._count._all ?? 0
      };
    });
  }

  async createChannel(workspaceId: string, userId: string, dto: CreateChannelDto) {
    await this.ensureWorkspaceMember(workspaceId, userId);

    return this.prisma.channel.create({
      data: {
        workspaceId,
        name: dto.name
      }
    });
  }

  private async ensureWorkspaceMember(workspaceId: string, userId: string) {
    await this.ensureWorkspaceExists(workspaceId);

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true }
    });

    if (!membership) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return;
      }

      throw new ForbiddenException("无权访问该工作区");
    }
  }

  private async ensureWorkspaceExists(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      throw new NotFoundException("工作区不存在");
    }
  }

  private async deleteStoredFile(storageKey: string) {
    try {
      await unlink(join(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
