import { Injectable } from "@nestjs/common";
import { AgentType, ExtractionStatus, MemoryType, MessageSenderType, MessageStatus } from "@prisma/client";
import { MemoryService } from "../../memory/memory.service";
import { PrismaService } from "../../prisma/prisma.service";
import { KnowledgeRepository } from "../../repositories/knowledge.repository";
import { hasAgentProviderConfig, parseAgentProviderConfigRef } from "../../agents/agent-provider-config";
import { EmbeddingService } from "../embedding.service";
import { AIProvider, ChatCompletionMessage, ChatStreamEvent } from "../providers/ai-provider";
import { AnthropicProvider } from "../providers/anthropic.provider";
import { OpenAICompatibleProvider } from "../providers/openai-compatible.provider";
import { AgentCapability, AgentEngine, AgentExecutionInput } from "./agent-engine";

const MAX_CONTEXT_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const TRUNCATED_SUFFIX = "\n...[truncated]";
const SYSTEM_PROMPT = [
  "你是工作区 AI 助手。",
  "请基于当前频道上下文提供准确、简洁、有帮助的中文 Markdown 回答。",
  "如果上下文不足，请明确说明不确定性，不要编造事实。"
].join(" ");

@Injectable()
export class DefaultChatEngine implements AgentEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly memoryService: MemoryService,
    private readonly embeddingService: EmbeddingService,
    private readonly openAICompatibleProvider: OpenAICompatibleProvider,
    private readonly anthropicProvider: AnthropicProvider
  ) {}

  async *stream(input: AgentExecutionInput): AsyncIterable<ChatStreamEvent> {
    const [messages, targetAgent] = await Promise.all([
      this.buildPromptMessages(input),
      input.agentId
        ? this.prisma.agent.findUnique({
            where: { id: input.agentId },
            select: {
              type: true,
              providerConfigRef: true,
              systemPrompt: true
            }
          })
        : this.prisma.agent.findFirst({
            where: {
              workspaceId: input.workspaceId,
              isDefault: true
            },
            select: {
              type: true,
              providerConfigRef: true,
              systemPrompt: true
            }
          })
    ]);
    const providerConfig = targetAgent?.providerConfigRef
      ? parseAgentProviderConfigRef(targetAgent.providerConfigRef)
      : undefined;
    const provider = this.resolveProvider(targetAgent?.type);

    if (targetAgent?.systemPrompt?.trim()) {
      messages[0] = {
        role: "system",
        content: targetAgent.systemPrompt.trim()
      };
    }

    for await (const event of provider.stream({
      messages,
      abortSignal: input.abortSignal,
      ...(hasAgentProviderConfig(providerConfig) ? { provider: providerConfig } : {})
    })) {
      yield event;
    }
  }

  getCapabilities(): AgentCapability[] {
    return [{
      name: "channel-chat",
      description: "Answering channel questions with recent workspace conversation context."
    }];
  }

  private resolveProvider(type?: AgentType | null): AIProvider {
    if (type === AgentType.ANTHROPIC) {
      return this.anthropicProvider;
    }

    return this.openAICompatibleProvider;
  }

  private async buildPromptMessages(input: AgentExecutionInput) {
    const [recentMessages, memories, searchableDocument] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          workspaceId: input.workspaceId,
          channelId: input.channelId,
          status: MessageStatus.COMPLETED
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: MAX_CONTEXT_MESSAGES
      }),
      this.memoryService.listPromptMemories(input.workspaceId, input.userId),
      this.prisma.knowledgeDocument.findFirst({
        where: {
          workspaceId: input.workspaceId,
          extractionStatus: ExtractionStatus.READY
        },
        select: {
          id: true
        }
      })
    ]);
    const orderedMessages = [...recentMessages]
      .slice(0, MAX_CONTEXT_MESSAGES)
      .reverse();
    const latestUserMessage = input.latestUserMessage ?? [...orderedMessages]
      .reverse()
      .find((message) => message.senderType === MessageSenderType.USER)
      ?.content;
    const memoryEntries = this.buildMemoryEntries(memories);
    const knowledgeSnippets = searchableDocument && latestUserMessage
      ? await this.buildKnowledgeSnippets(input.workspaceId, latestUserMessage)
      : [];
    const promptMessages: ChatCompletionMessage[] = [{
      role: "system",
      content: this.buildSystemPrompt(memoryEntries, knowledgeSnippets)
    }];

    for (const message of orderedMessages) {
      promptMessages.push({
        role: message.senderType === MessageSenderType.AGENT ? "assistant" : "user",
        content: this.truncateContent(message.content)
      });
    }

    return promptMessages;
  }

  private buildSystemPrompt(memoryEntries: string[], knowledgeSnippets: string[]) {
    const sections = [SYSTEM_PROMPT];

    if (memoryEntries.length > 0) {
      sections.push(`记忆上下文:\n${memoryEntries.join("\n")}`);
    }

    if (knowledgeSnippets.length > 0) {
      sections.push(`参考资料:\n${knowledgeSnippets.join("\n\n")}`);
    }

    return sections.join("\n\n");
  }

  private buildMemoryEntries(memories: Array<{ type: MemoryType; content: string }>) {
    const labels: Record<MemoryType, string> = {
      [MemoryType.PERSONAL]: "个人记忆",
      [MemoryType.TEAM]: "团队记忆",
      [MemoryType.PROJECT]: "项目记忆"
    };

    return [MemoryType.PERSONAL, MemoryType.TEAM, MemoryType.PROJECT]
      .map((type) => {
        const entries = memories
          .filter((memory) => memory.type === type)
          .map((memory) => `- ${memory.content}`);

        if (entries.length === 0) {
          return null;
        }

        return `${labels[type]}:\n${entries.join("\n")}`;
      })
      .filter((entry): entry is string => Boolean(entry));
  }

  private async buildKnowledgeSnippets(workspaceId: string, latestUserMessage: string) {
    const queryEmbedding = await this.embeddingService.embed(latestUserMessage);

    if (!queryEmbedding) {
      return [];
    }

    const chunks = await this.knowledgeRepository.searchSimilarChunks(workspaceId, queryEmbedding);

    return chunks.map((chunk, index) => `[${index + 1}] 来源：${chunk.filename}\n${chunk.content}`);
  }

  private truncateContent(content: string) {
    if (content.length <= MAX_MESSAGE_CHARS) {
      return content;
    }

    return `${content.slice(0, MAX_MESSAGE_CHARS - TRUNCATED_SUFFIX.length)}${TRUNCATED_SUFFIX}`;
  }
}
