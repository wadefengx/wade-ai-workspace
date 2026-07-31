import { MessageSenderType, MessageStatus } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { MemoryService } from "../../memory/memory.service";
import { OllamaService } from "../../ollama.service";
import { PrismaService } from "../../prisma/prisma.service";
import { KnowledgeRepository } from "../../repositories/knowledge.repository";
import { AI_PROVIDER } from "../providers/ai-provider";
import { DefaultChatEngine } from "./default-chat.engine";

describe("DefaultChatEngine", () => {
  const prisma = {
    agent: {
      findFirst: jest.fn()
    },
    message: {
      findMany: jest.fn()
    },
    knowledgeDocument: {
      findFirst: jest.fn()
    }
  };
  const provider = {
    stream: jest.fn()
  };
  const knowledgeRepository = {
    searchSimilarChunks: jest.fn()
  };
  const memoryService = {
    listPromptMemories: jest.fn()
  };
  const ollamaService = {
    embed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.agent.findFirst.mockResolvedValue(null);
    memoryService.listPromptMemories.mockResolvedValue([]);
    prisma.knowledgeDocument.findFirst.mockResolvedValue(null);
  });

  it("builds a system prompt with the most recent 20 completed messages", async () => {
    prisma.message.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        id: `message-${25 - index}`,
        workspaceId: "workspace-1",
        channelId: "channel-1",
        senderType: index % 2 === 0 ? MessageSenderType.USER : MessageSenderType.AGENT,
        senderId: `sender-${index}`,
        content: `message-${25 - index}`,
        status: MessageStatus.COMPLETED,
        createdAt: new Date(`2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        updatedAt: new Date(`2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`)
      }))
    );
    provider.stream.mockReturnValue(createEvents([{ type: "done" }]));
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: KnowledgeRepository,
        useValue: knowledgeRepository
      }, {
        provide: MemoryService,
        useValue: memoryService
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, {
        provide: AI_PROVIDER,
        useValue: provider
      }, DefaultChatEngine]
    }).compile();
    const engine = module.get(DefaultChatEngine);

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    const promptMessages = provider.stream.mock.calls[0][0].messages;
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        channelId: "channel-1",
        status: MessageStatus.COMPLETED
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20
    });
    expect(promptMessages).toHaveLength(21);
    expect(promptMessages[0]).toEqual(expect.objectContaining({
      role: "system"
    }));
    expect(promptMessages[1]).toEqual({
      role: "assistant",
      content: "message-6"
    });
    expect(promptMessages.at(-1)).toEqual({
      role: "user",
      content: "message-25"
    });
  });

  it("truncates oversized message content before calling the provider", async () => {
    prisma.message.findMany.mockResolvedValue([{
      id: "message-1",
      workspaceId: "workspace-1",
      channelId: "channel-1",
      senderType: MessageSenderType.USER,
      senderId: "user-1",
      content: "x".repeat(5_000),
      status: MessageStatus.COMPLETED,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    }]);
    provider.stream.mockReturnValue(createEvents([{ type: "done" }]));
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: KnowledgeRepository,
        useValue: knowledgeRepository
      }, {
        provide: MemoryService,
        useValue: memoryService
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, {
        provide: AI_PROVIDER,
        useValue: provider
      }, DefaultChatEngine]
    }).compile();
    const engine = module.get(DefaultChatEngine);

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    const truncatedContent = provider.stream.mock.calls[0][0].messages[1].content as string;
    expect(truncatedContent).toHaveLength(4_000);
    expect(truncatedContent.endsWith("\n...[truncated]")).toBe(true);
  });

  it("injects grouped memories and referenced knowledge into the system prompt", async () => {
    prisma.message.findMany.mockResolvedValue([{
      id: "message-1",
      workspaceId: "workspace-1",
      channelId: "channel-1",
      senderType: MessageSenderType.USER,
      senderId: "user-1",
      content: "@AI 总结文档",
      status: MessageStatus.COMPLETED,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    }]);
    memoryService.listPromptMemories.mockResolvedValue([{
      type: "PERSONAL",
      content: "我负责 API"
    }, {
      type: "TEAM",
      content: "团队默认用中文"
    }, {
      type: "PROJECT",
      content: "项目目标是知识库问答"
    }]);
    prisma.knowledgeDocument.findFirst.mockResolvedValue({
      id: "document-1"
    });
    ollamaService.embed.mockResolvedValue([1, 0]);
    knowledgeRepository.searchSimilarChunks.mockResolvedValue([{
      chunkId: "chunk-1",
      documentId: "document-1",
      filename: "guide.md",
      content: "这里是文档片段",
      chunkIndex: 0,
      similarity: 1
    }]);
    provider.stream.mockReturnValue(createEvents([{ type: "done" }]));
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: KnowledgeRepository,
        useValue: knowledgeRepository
      }, {
        provide: MemoryService,
        useValue: memoryService
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, {
        provide: AI_PROVIDER,
        useValue: provider
      }, DefaultChatEngine]
    }).compile();
    const engine = module.get(DefaultChatEngine);

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1",
      latestUserMessage: "@AI 总结文档"
    }));

    const systemPrompt = provider.stream.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("记忆上下文");
    expect(systemPrompt).toContain("个人记忆");
    expect(systemPrompt).toContain("团队记忆");
    expect(systemPrompt).toContain("项目记忆");
    expect(systemPrompt).toContain("参考资料");
    expect(systemPrompt).toContain("guide.md");
    expect(systemPrompt).toContain("这里是文档片段");
    expect(ollamaService.embed).toHaveBeenCalledWith("@AI 总结文档");
    expect(knowledgeRepository.searchSimilarChunks).toHaveBeenCalledWith("workspace-1", [1, 0]);
  });

  it("passes the default agent provider config to the AI provider when present", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      providerConfigRef: JSON.stringify({
        baseUrl: "http://provider.test/v1",
        apiKey: "secret-key",
        model: "qwen3:8b"
      })
    });
    prisma.message.findMany.mockResolvedValue([]);
    provider.stream.mockReturnValue(createEvents([{ type: "done" }]));
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: KnowledgeRepository,
        useValue: knowledgeRepository
      }, {
        provide: MemoryService,
        useValue: memoryService
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, {
        provide: AI_PROVIDER,
        useValue: provider
      }, DefaultChatEngine]
    }).compile();
    const engine = module.get(DefaultChatEngine);

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    expect(provider.stream).toHaveBeenCalledWith(expect.objectContaining({
      provider: {
        baseUrl: "http://provider.test/v1",
        apiKey: "secret-key",
        model: "qwen3:8b"
      }
    }));
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
