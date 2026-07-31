import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MemoryType, Prisma, WorkspaceRole } from "@prisma/client";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMemoryDto } from "./dto/create-memory.dto";
import { UpdateMemoryDto } from "./dto/update-memory.dto";

@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listVisibleMemories(workspaceId: string, userId: string) {
    if (await isGlobalAdmin(this.prisma, userId)) {
      return this.prisma.memory.findMany({
        where: { workspaceId },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }]
      });
    }

    return this.prisma.memory.findMany({
      where: this.buildVisibleWhere(workspaceId, userId),
      orderBy: [{ type: "asc" }, { createdAt: "asc" }]
    });
  }

  async listPromptMemories(workspaceId: string, userId: string) {
    if (await isGlobalAdmin(this.prisma, userId)) {
      return this.prisma.memory.findMany({
        where: {
          workspaceId,
          enabled: true
        },
        orderBy: [{ type: "asc" }, { createdAt: "asc" }]
      });
    }

    return this.prisma.memory.findMany({
      where: this.buildVisibleWhere(workspaceId, userId, true),
      orderBy: [{ type: "asc" }, { createdAt: "asc" }]
    });
  }

  createMemory(workspaceId: string, userId: string, dto: CreateMemoryDto) {
    return this.prisma.memory.create({
      data: {
        workspaceId,
        type: dto.type,
        content: dto.content,
        userId: dto.type === MemoryType.PERSONAL ? userId : null,
        createdBy: userId
      }
    });
  }

  async updateMemory(memoryId: string, userId: string, dto: UpdateMemoryDto) {
    if (dto.content === undefined && dto.enabled === undefined) {
      throw new BadRequestException("至少提供一个可更新字段");
    }

    const memory = await this.ensureManagePermission(memoryId, userId);

    return this.prisma.memory.update({
      where: { id: memory.id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
      }
    });
  }

  async deleteMemory(memoryId: string, userId: string) {
    const memory = await this.ensureManagePermission(memoryId, userId);

    return this.prisma.memory.delete({
      where: { id: memory.id }
    });
  }

  private buildVisibleWhere(workspaceId: string, userId: string, enabledOnly = false): Prisma.MemoryWhereInput {
    return {
      workspaceId,
      ...(enabledOnly ? { enabled: true } : {}),
      OR: [{
        type: MemoryType.PERSONAL,
        userId
      }, {
        type: {
          in: [MemoryType.TEAM, MemoryType.PROJECT]
        }
      }]
    };
  }

  private async ensureManagePermission(memoryId: string, userId: string) {
    const memory = await this.prisma.memory.findUnique({
      where: { id: memoryId }
    });

    if (!memory) {
      throw new NotFoundException("记忆不存在");
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: memory.workspaceId,
        userId
      },
      select: {
        id: true,
        role: true
      }
    });

    if (!membership) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return memory;
      }

      throw new ForbiddenException("无权访问该工作区");
    }

    if (
      memory.createdBy !== userId
      && membership.role !== WorkspaceRole.OWNER
      && !(await isGlobalAdmin(this.prisma, userId))
    ) {
      throw new ForbiddenException("无权修改该记忆");
    }

    return memory;
  }
}
