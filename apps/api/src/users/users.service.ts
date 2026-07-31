import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ensureGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(operatorId: string, query?: string) {
    await ensureGlobalAdmin(this.prisma, operatorId);
    const keyword = query?.trim();

    return this.prisma.user.findMany({
      ...(keyword
        ? {
            where: {
              OR: [{
                email: {
                  contains: keyword,
                  mode: "insensitive"
                }
              }, {
                name: {
                  contains: keyword,
                  mode: "insensitive"
                }
              }]
            }
          }
        : {}),
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }

  async updateUserRole(operatorId: string, userId: string, dto: UpdateUserRoleDto) {
    await ensureGlobalAdmin(this.prisma, operatorId);
    this.ensureNotSelf(operatorId, userId, "不能修改自己的角色");

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!targetUser) {
      throw new NotFoundException("用户不存在");
    }

    if (targetUser.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      await this.ensureAnotherAdminExists();
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
  }

  async removeUser(operatorId: string, userId: string) {
    await ensureGlobalAdmin(this.prisma, operatorId);
    this.ensureNotSelf(operatorId, userId, "不能删除自己");

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true
      }
    });

    if (!targetUser) {
      throw new NotFoundException("用户不存在");
    }

    if (targetUser.role === UserRole.ADMIN) {
      await this.ensureAnotherAdminExists();
    }

    const ownerWorkspace = await this.prisma.workspace.findFirst({
      where: {
        createdById: userId
      },
      select: { id: true }
    });

    if (ownerWorkspace) {
      throw new BadRequestException("请先转交该用户拥有的工作区");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.deleteMany({
        where: { userId }
      });
      await tx.memory.updateMany({
        where: { userId },
        data: { userId: null }
      });
      await tx.user.delete({
        where: { id: userId }
      });
    });

    return { id: userId };
  }

  private ensureNotSelf(operatorId: string, userId: string, message: string) {
    if (operatorId === userId) {
      throw new BadRequestException(message);
    }
  }

  private async ensureAnotherAdminExists() {
    const adminCount = await this.prisma.user.count({
      where: {
        role: UserRole.ADMIN
      }
    });

    if (adminCount <= 1) {
      throw new BadRequestException("系统至少需要保留一个全局管理员");
    }
  }
}
