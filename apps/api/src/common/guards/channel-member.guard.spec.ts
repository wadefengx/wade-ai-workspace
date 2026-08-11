import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { ChannelMemberGuard } from "./channel-member.guard";

describe("ChannelMemberGuard", () => {
  const prisma = {
    channel: {
      findUnique: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an outsider from a channel's owning workspace", async () => {
    prisma.channel.findUnique.mockResolvedValue({
      id: "channel-1",
      workspaceId: "workspace-1"
    });
    prisma.workspaceMember.findFirst.mockResolvedValue(null);
    const guard = new ChannelMemberGuard(prisma as never);
    const request = {
      params: { channelId: "channel-1" },
      user: { id: "outsider-1", role: UserRole.USER }
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(request).toMatchObject({
      channelAccess: {
        channelId: "channel-1",
        workspaceId: "workspace-1"
      }
    });
  });

  it("allows global administrators without workspace membership", async () => {
    prisma.channel.findUnique.mockResolvedValue({
      id: "channel-1",
      workspaceId: "workspace-1"
    });
    const guard = new ChannelMemberGuard(prisma as never);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { channelId: "channel-1" },
          user: { id: "admin-1", role: UserRole.ADMIN }
        })
      })
    };

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
  });
});
