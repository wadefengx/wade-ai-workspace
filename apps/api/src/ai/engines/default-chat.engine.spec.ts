import { AgentType, MessageSenderType, MessageStatus } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { MemoryService } from "../../memory/memory.service";
import { PrismaService } from "../../prisma/prisma.service";
import { KnowledgeRepository } from "../../repositories/knowledge.repository";
import { EmbeddingService } from "../embedding.service";
import { AnthropicProvider } from "../providers/anthropic.provider";
import { OpenAICompatibleProvider } from "../providers/openai-compatible.provider";
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
  const openAICompatibleProvider = {
    stream: jest.fn()
  };
  const anthropicProvider = {
    stream: jest.fn()
  };
  const knowledgeRepository = {
    searchSimilarChunks: jest.fn()
  };
  const memoryService = {
    listPromptMemories: jest.fn()
  };
  const embeddingService = {
    embed: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.agent.findFirst.mockResolvedValue(null);
    prisma.message.findMany.mockResolvedValue([]);
    memoryService.listPromptMemories.mockResolvedValue([]);
    prisma.knowledgeDocument.findFirst.mockResolvedValue(null);
    openAICompatibleProvider.stream.mockReturnValue(createEvents([{ type: "done" }]));
    anthropicProvider.stream.mockReturnValue(createEvents([{ type: "done" }]));
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
    const engine = await createEngine();

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    const promptMessages = openAICompatibleProvider.stream.mock.calls[0][0].messages;
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
    const engine = await createEngine();

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    const truncatedContent = openAICompatibleProvider.stream.mock.calls[0][0].messages[1].content as string;
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
      content: "@AI summarize the document",
      status: MessageStatus.COMPLETED,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    }]);
    memoryService.listPromptMemories.mockResolvedValue([{
      type: "PERSONAL",
      content: "I am responsible for the API"
    }, {
      type: "TEAM",
      content: "The team defaults to Chinese"
    }, {
      type: "PROJECT",
      content: "The project goal is knowledge-base Q&A"
    }]);
    prisma.knowledgeDocument.findFirst.mockResolvedValue({
      id: "document-1"
    });
    embeddingService.embed.mockResolvedValue([1, 0]);
    knowledgeRepository.searchSimilarChunks.mockResolvedValue([{
      chunkId: "chunk-1",
      documentId: "document-1",
      filename: "guide.md",
      content: "This is a document excerpt",
      chunkIndex: 0,
      similarity: 1
    }]);
    const engine = await createEngine();

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1",
      latestUserMessage: "@AI summarize the document"
    }));

    const systemPrompt = openAICompatibleProvider.stream.mock.calls[0][0].messages[0].content as string;
    expect(systemPrompt).toContain("Memory context");
    expect(systemPrompt).toContain("guide.md");
    expect(embeddingService.embed).toHaveBeenCalledWith("@AI summarize the document");
  });

  it("passes provider config to the openai-compatible provider for non-anthropic agents", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      type: AgentType.OPENAI_COMPATIBLE,
      providerConfigRef: JSON.stringify({
        baseUrl: "http://provider.test/v1",
        apiKey: "secret-key",
        model: "qwen3:8b"
      })
    });
    const engine = await createEngine();

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    expect(openAICompatibleProvider.stream).toHaveBeenCalledWith(expect.objectContaining({
      provider: {
        baseUrl: "http://provider.test/v1",
        apiKey: "secret-key",
        model: "qwen3:8b"
      }
    }));
    expect(anthropicProvider.stream).not.toHaveBeenCalled();
  });

  it("selects the anthropic provider for anthropic agents", async () => {
    prisma.agent.findFirst.mockResolvedValue({
      type: AgentType.ANTHROPIC,
      providerConfigRef: JSON.stringify({
        apiKey: "claude-key",
        model: "claude-3-5-sonnet-latest"
      })
    });
    const engine = await createEngine();

    await collect(engine.stream({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      userId: "user-1"
    }));

    expect(anthropicProvider.stream).toHaveBeenCalledWith(expect.objectContaining({
      provider: {
        apiKey: "claude-key",
        model: "claude-3-5-sonnet-latest"
      }
    }));
    expect(openAICompatibleProvider.stream).not.toHaveBeenCalled();
  });

  async function createEngine() {
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
        provide: EmbeddingService,
        useValue: embeddingService
      }, {
        provide: OpenAICompatibleProvider,
        useValue: openAICompatibleProvider
      }, {
        provide: AnthropicProvider,
        useValue: anthropicProvider
      }, DefaultChatEngine]
    }).compile();

    return module.get(DefaultChatEngine);
  }
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
