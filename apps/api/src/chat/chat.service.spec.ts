import { MessageStatus, MessageSenderType } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { AGENT_ENGINE } from "../ai/engines/agent-engine";
import { PrismaService } from "../prisma/prisma.service";
import { ChatService } from "./chat.service";

describe("ChatService", () => {
  const prisma = {
    agent: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    message: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    }
  };
  const agentEngine = {
    stream: jest.fn(),
    getCapabilities: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("streams AI replies through PENDING -> STREAMING -> COMPLETED", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      engineType: "default-chat",
      providerConfigRef: null,
      capabilitiesJson: null,
      isDefault: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });
    prisma.message.create
      .mockResolvedValueOnce({
        id: "user-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.USER,
        senderId: "user-1",
        content: "@AI hello",
        status: MessageStatus.COMPLETED,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      })
      .mockResolvedValueOnce({
        id: "agent-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.AGENT,
        senderId: "agent-1",
        content: "",
        status: MessageStatus.PENDING,
        createdAt: new Date("2024-01-01T00:00:01.000Z"),
        updatedAt: new Date("2024-01-01T00:00:01.000Z")
      });
    prisma.message.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    agentEngine.stream.mockReturnValue(createEvents([{
      type: "token" as const,
      content: "Hello"
    }, {
      type: "done" as const
    }]));
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: AGENT_ENGINE,
        useValue: agentEngine
      }, ChatService]
    }).compile();
    const service = module.get(ChatService);

    await expect(collect(service.streamAgentReply({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1",
      content: "@AI hello"
    }))).resolves.toEqual([{
      type: "token",
      content: "Hello"
    }, {
      type: "done",
      messageId: "agent-message-1"
    }]);
    expect(prisma.message.create).toHaveBeenNthCalledWith(1, {
      data: {
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.USER,
        senderId: "user-1",
        content: "@AI hello",
        status: MessageStatus.COMPLETED
      }
    });
    expect(prisma.message.create).toHaveBeenNthCalledWith(2, {
      data: {
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.AGENT,
        senderId: "agent-1",
        content: "",
        status: MessageStatus.PENDING
      }
    });
    expect(prisma.message.update).toHaveBeenNthCalledWith(1, {
      where: { id: "agent-message-1" },
      data: {
        status: MessageStatus.STREAMING
      }
    });
    expect(prisma.message.update).toHaveBeenNthCalledWith(2, {
      where: { id: "agent-message-1" },
      data: {
        status: MessageStatus.COMPLETED,
        content: "Hello"
      }
    });
  });

  it("marks the agent message failed when the engine errors", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      engineType: "default-chat",
      providerConfigRef: null,
      capabilitiesJson: null,
      isDefault: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });
    prisma.message.create
      .mockResolvedValueOnce({
        id: "user-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.USER,
        senderId: "user-1",
        content: "@AI hello",
        status: MessageStatus.COMPLETED,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      })
      .mockResolvedValueOnce({
        id: "agent-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.AGENT,
        senderId: "agent-1",
        content: "",
        status: MessageStatus.PENDING,
        createdAt: new Date("2024-01-01T00:00:01.000Z"),
        updatedAt: new Date("2024-01-01T00:00:01.000Z")
      });
    prisma.message.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    agentEngine.stream.mockReturnValue((async function* () {
      throw new Error("provider unavailable");
    })());
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: AGENT_ENGINE,
        useValue: agentEngine
      }, ChatService]
    }).compile();
    const service = module.get(ChatService);

    await expect(collect(service.streamAgentReply({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1",
      content: "@AI hello"
    }))).resolves.toEqual([{
      type: "error",
      message: "provider unavailable"
    }]);
    expect(prisma.message.update).toHaveBeenNthCalledWith(2, {
      where: { id: "agent-message-1" },
      data: {
        status: MessageStatus.FAILED,
        content: ""
      }
    });
  });

  it("marks the agent message failed and stops emitting after disconnect", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      id: "agent-1",
      workspaceId: "workspace-1",
      name: "Workspace AI",
      engineType: "default-chat",
      providerConfigRef: null,
      capabilitiesJson: null,
      isDefault: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });
    prisma.message.create
      .mockResolvedValueOnce({
        id: "user-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.USER,
        senderId: "user-1",
        content: "@AI hello",
        status: MessageStatus.COMPLETED,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      })
      .mockResolvedValueOnce({
        id: "agent-message-1",
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: MessageSenderType.AGENT,
        senderId: "agent-1",
        content: "",
        status: MessageStatus.PENDING,
        createdAt: new Date("2024-01-01T00:00:01.000Z"),
        updatedAt: new Date("2024-01-01T00:00:01.000Z")
      });
    prisma.message.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const abortController = new AbortController();
    agentEngine.stream.mockReturnValue((async function* () {
      yield {
        type: "token" as const,
        content: "partial"
      };
      abortController.abort();
    })());
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: AGENT_ENGINE,
        useValue: agentEngine
      }, ChatService]
    }).compile();
    const service = module.get(ChatService);

    await expect(collect(service.streamAgentReply({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1",
      content: "@AI hello",
      abortSignal: abortController.signal
    }))).resolves.toEqual([{
      type: "token",
      content: "partial"
    }]);
    expect(prisma.message.update).toHaveBeenNthCalledWith(2, {
      where: { id: "agent-message-1" },
      data: {
        status: MessageStatus.FAILED,
        content: "partial"
      }
    });
  });
});

async function collect<T>(iterable: AsyncIterable<T>) {
  const items: T[] = [];

  for await (const item of iterable) {
    items.push(item);
  }

  return items;
}

async function* createEvents<T>(items: T[]) {
  for (const item of items) {
    yield item;
  }
}
