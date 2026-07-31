import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceMemberGuard } from "./workspace-member.guard";

describe("WorkspaceMemberGuard", () => {
  const prisma = {
    workspace: {
      findUnique: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows workspace members", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceMemberGuard]
    }).compile();
    const guard = module.get(WorkspaceMemberGuard);

    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });

    await expect(guard.canActivate(createContext({
      params: { workspaceId: "workspace-1" },
      user: { id: "user-1" }
    }))).resolves.toBe(true);
  });

  it("returns 404 when workspace does not exist", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceMemberGuard]
    }).compile();
    const guard = module.get(WorkspaceMemberGuard);

    prisma.workspace.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(createContext({
      params: { workspaceId: "missing-workspace" },
      user: { id: "user-1" }
    }))).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 for non-members", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceMemberGuard]
    }).compile();
    const guard = module.get(WorkspaceMemberGuard);

    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext({
      params: { workspaceId: "workspace-1" },
      user: { id: "user-2" }
    }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows global admins without workspace membership", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, WorkspaceMemberGuard]
    }).compile();
    const guard = module.get(WorkspaceMemberGuard);

    prisma.workspace.findUnique.mockResolvedValue({ id: "workspace-1" });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(createContext({
      params: { workspaceId: "workspace-1" },
      user: { id: "admin-1", role: UserRole.ADMIN }
    }))).resolves.toBe(true);
  });
});

function createContext(request: {
  params: Record<string, string | undefined>;
  user?: { id: string; role?: UserRole };
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as ExecutionContext;
}
