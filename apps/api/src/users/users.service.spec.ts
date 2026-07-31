import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const prisma = {
    user: {
      findMany: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty array when q is missing or blank", async () => {
    const service = await createService();

    await expect(service.searchUsers(undefined)).resolves.toEqual([]);
    await expect(service.searchUsers("   ")).resolves.toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("searches users by email or name with case-insensitive contains filters", async () => {
    prisma.user.findMany.mockResolvedValue([{
      id: "user-1",
      name: "Alice",
      email: "alice@example.com"
    }]);
    const service = await createService();

    await expect(service.searchUsers(" ali ")).resolves.toEqual([{
      id: "user-1",
      name: "Alice",
      email: "alice@example.com"
    }]);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{
          email: {
            contains: "ali",
            mode: "insensitive"
          }
        }, {
          name: {
            contains: "ali",
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
  });

  async function createService() {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, UsersService]
    }).compile();

    return module.get(UsersService);
  }
});
