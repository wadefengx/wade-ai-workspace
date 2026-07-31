import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export function hasGlobalAdminRole(role?: UserRole | null) {
  return role === UserRole.ADMIN;
}

export async function isGlobalAdmin(prisma: PrismaService, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  return hasGlobalAdminRole(user?.role);
}

export async function ensureGlobalAdmin(prisma: PrismaService, userId: string) {
  if (await isGlobalAdmin(prisma, userId)) {
    return;
  }

  throw new ForbiddenException("仅全局管理员可执行该操作");
}
