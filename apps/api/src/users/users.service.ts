import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(query?: string) {
    const keyword = query?.trim();

    if (!keyword) {
      return [];
    }

    return this.prisma.user.findMany({
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
      },
      take: 10,
      select: {
        id: true,
        name: true,
        email: true
      }
    });
  }
}
