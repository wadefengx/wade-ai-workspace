import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(WorkspaceService.name);

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
    const workspace = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    this.logger.log(`Created workspace ${workspace.id}`);
    return workspace;
  }

  async updateWorkspace(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.ensureOwnerOrGlobalAdmin(workspaceId, userId);

    if (dto.defaultAgentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.defaultAgentId, workspaceId },
        select: { id: true }
      });

      if (!agent) {
        throw new BadRequestException("The default agent must belong to the current workspace");
      }
    }

    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
        icon: dto.icon,
        ...(dto.defaultAgentId !== undefined ? { defaultAgentId: dto.defaultAgentId || null } : {})
      },
      select: {
        id: true,
        name: true,
        icon: true,
        createdById: true,
        defaultAgentId: true,
        createdAt: true,
        updatedAt: true
      }
    });
    this.logger.log(`Updated workspace ${workspaceId}`);
    return workspace;
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
      throw new NotFoundException("Workspace owner not found");
    }

    if (!targetMembership) {
      throw new BadRequestException("The target user is not a workspace member");
    }

    if (targetMembership.userId === currentOwner.userId) {
      throw new BadRequestException("Cannot transfer to the current owner");
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

    this.logger.log(`Transferred workspace ${workspaceId} ownership`);
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

    this.logger.log(`Deleted workspace ${workspaceId}`);
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
      throw new BadRequestException("Cannot assign the OWNER role directly");
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true }
    });

    if (!targetUser) {
      throw new NotFoundException("This email address is not registered");
    }

    const existing = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUser.id },
      select: { id: true }
    });

    if (existing) {
      throw new ConflictException("This user is already a workspace member");
    }

    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: dto.role ?? WorkspaceRole.MEMBER
      },
      select: { id: true, userId: true, role: true, createdAt: true }
    });
    this.logger.log(`Added member ${member.id} to workspace ${workspaceId}`);
    return member;
  }

  async updateMemberRole(memberId: string, operatorId: string, dto: UpdateMemberRoleDto) {
    if (dto.role === WorkspaceRole.OWNER) {
      throw new BadRequestException("Cannot assign the OWNER role directly");
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      select: { id: true, workspaceId: true, userId: true, role: true }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    await this.ensureManager(membership.workspaceId, operatorId);

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("Cannot change the OWNER role");
    }

    if (membership.userId === operatorId && dto.role !== WorkspaceRole.ADMIN) {
      throw new BadRequestException("Administrators cannot demote themselves; ask another administrator to do it");
    }

    const member = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      select: { id: true, userId: true, role: true }
    });
    this.logger.log(`Updated role for member ${memberId}`);
    return member;
  }

  async removeMember(memberId: string, operatorId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
      select: { id: true, workspaceId: true, userId: true, role: true }
    });

    if (!membership) {
      throw new NotFoundException("Member not found");
    }

    await this.ensureManager(membership.workspaceId, operatorId);

    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("Cannot remove the workspace owner");
    }

    // The OWNER cannot be removed or demoted; ownerCount is always ≥1, so no additional validation is needed.

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });

    this.logger.log(`Removed member ${memberId}`);
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
        throw new ForbiddenException("You do not have access to this workspace");
      }

      throw new ForbiddenException("Only an OWNER or ADMIN can perform this action");
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
      throw new ForbiddenException("You do not have access to this workspace");
    }

    throw new ForbiddenException("Only the OWNER can perform this action");
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

    const channel = await this.prisma.channel.create({
      data: {
        workspaceId,
        name: dto.name
      }
    });
    this.logger.log(`Created channel ${channel.id} in workspace ${workspaceId}`);
    return channel;
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

      throw new ForbiddenException("You do not have access to this workspace");
    }
  }

  private async ensureWorkspaceExists(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }
  }

  private async deleteStoredFile(storageKey: string) {
    try {
      await unlink(join(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR, storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger.error(`Failed to delete stored file ${storageKey}`, error instanceof Error ? error.stack : undefined);
        throw error;
      }
    }
  }
}
