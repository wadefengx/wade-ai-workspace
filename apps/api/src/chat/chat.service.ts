import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Agent, AgentType, MessageStatus, MessageSenderType } from "@prisma/client";
import { parseAgentProviderConfigRef } from "../agents/agent-provider-config";
import { AGENT_ENGINE, AgentEngine } from "../ai/engines/agent-engine";
import { ChatCitation } from "../ai/providers/ai-provider";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ListChannelMessagesQueryDto } from "./dto/list-channel-messages-query.dto";
import { UpdateMessageFeedbackDto } from "./dto/update-message-feedback.dto";

export type ChatSseEvent =
  | {
      type: "token";
      content: string;
    }
  | {
      type: "citations";
      citations: ChatCitation[];
    }
  | {
      type: "done";
      messageId: string;
      agentName?: string;
      modelName?: string | null;
      harness?: string;
    }
  | {
      type: "error";
      message: string;
    };

type StreamAgentReplyInput = {
  workspaceId: string;
  channelId: string;
  userId: string;
  content: string;
  abortSignal?: AbortSignal;
};

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_ENGINE) private readonly agentEngine: AgentEngine
  ) {}

  async listMessages(workspaceId: string, channelId: string, query: ListChannelMessagesQueryDto) {
    const cursorFilter = await this.buildCursorFilter(channelId, query.cursor);
    const messages = await this.prisma.message.findMany({
      where: {
        workspaceId,
        channelId,
        ...cursorFilter
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit + 1
    });
    const hasMore = messages.length > query.limit;
    const items = hasMore ? messages.slice(0, query.limit) : messages;

    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null
    };
  }

  createMessage(workspaceId: string, channelId: string, userId: string, dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        workspaceId,
        channelId,
        senderType: MessageSenderType.USER,
        senderId: userId,
        content: dto.content,
        status: MessageStatus.COMPLETED
      }
    });
  }

  async updateMessageFeedback(
    workspaceId: string,
    channelId: string,
    messageId: string,
    dto: UpdateMessageFeedbackDto
  ) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        workspaceId,
        channelId
      }
    });

    if (!message) {
      throw new NotFoundException("Message not found");
    }

    const nextFeedback = message.feedback === dto.type ? null : dto.type;

    return this.prisma.message.update({
      where: { id: message.id },
      data: {
        feedback: nextFeedback
      }
    });
  }

  /**
   * Use the local model to generate a concise conversation title (≤20 characters) and update the channel name.
   * Graceful fallback: return the current title without throwing a 500 if the model is unavailable.
   */
  async generateChannelTitle(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId }
    });

    if (!channel) {
      throw new NotFoundException("Channel not found");
    }

    try {
      const messages = await this.prisma.message.findMany({
        where: { channelId, senderType: MessageSenderType.USER },
        orderBy: { createdAt: "asc" },
        take: 6,
        select: { content: true }
      });
      const transcript = messages.map((message) => message.content.trim()).filter(Boolean).join("\n").slice(0, 800);

      if (!transcript) {
        return { title: channel.name };
      }

      const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
      const model = process.env.OLLAMA_CHAT_MODEL ?? "qwen3:8b";
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are a conversation title generator. Based on the user-provided conversation, generate a concise English title no longer than 15 characters. Output only the title itself, with no quotation marks, explanation, or punctuation."
            },
            { role: "user", content: `Conversation:\n${transcript}` }
          ],
          options: { temperature: 0.3 }
        })
      });

      if (!response.ok) {
        return { title: channel.name };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawTitle = data?.choices?.[0]?.message?.content?.trim() ?? "";
      const title = rawTitle.replace(/^["“”'\s]+|["“”'\s]+$/g, "").slice(0, 20);

      if (!title) {
        return { title: channel.name };
      }

      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { name: title }
      });

      return { title };
    } catch {
      // Model unavailable or timed out: keep the original title.
      return { title: channel.name };
    }
  }

  async *streamAgentReply(input: StreamAgentReplyInput): AsyncIterable<ChatSseEvent> {
    const targetAgent = (await this.resolveMentionedAgent(input.workspaceId, input.content))
      ?? (await this.resolveWorkspaceDefaultAgent(input.workspaceId))
      ?? (await this.ensureDefaultAgent(input.workspaceId));
    const agent = targetAgent;
    // ponytail: The frontend persists user messages through POST /messages; stream creates only the AI response message to avoid duplicate writes.
    const agentMessage = await this.prisma.message.create({
      data: {
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        senderType: MessageSenderType.AGENT,
        senderId: agent.id,
        content: "",
        status: MessageStatus.PENDING
      }
    });
    let fullContent = "";

    try {
      await this.prisma.message.update({
        where: { id: agentMessage.id },
        data: {
          status: MessageStatus.STREAMING
        }
      });

      for await (const event of this.agentEngine.stream({
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        userId: input.userId,
        latestUserMessage: input.content,
        agentId: agent.id,
        abortSignal: input.abortSignal
      })) {
        if (event.type === "token") {
          fullContent += event.content;
          yield {
            type: "token",
            content: event.content
          };
          continue;
        }

        if (event.type === "citations") {
          yield {
            type: "citations",
            citations: event.citations
          };
          continue;
        }

        if (event.type === "error") {
          throw new Error(event.message);
        }

        break;
      }

      if (input.abortSignal?.aborted) {
        await this.markFailed(agentMessage.id, fullContent);
        return;
      }

      await this.prisma.message.update({
        where: { id: agentMessage.id },
        data: {
          status: MessageStatus.COMPLETED,
          content: fullContent
        }
      });

      yield {
        type: "done",
        messageId: agentMessage.id,
        agentName: agent?.name,
        modelName: this.resolveAgentModel(agent),
        harness: agent?.harness ?? "OLLAMA"
      };
    } catch (error) {
      await this.markFailed(agentMessage.id, fullContent);

      if (input.abortSignal?.aborted || this.isAbortError(error)) {
        return;
      }

      const rawMessage = this.normalizeError(error);
      const harness = agent?.harness ?? "OLLAMA";
      const harnessHint = HARNESS_START_HINT[harness as keyof typeof HARNESS_START_HINT];
      const message = harnessHint && this.isConnectionError(rawMessage)
        ? `${rawMessage}。${harnessHint}`
        : rawMessage;

      yield {
        type: "error",
        message
      };
    }
  }

  private async buildCursorFilter(channelId: string, cursor?: string) {
    if (!cursor) {
      return {};
    }

    const cursorMessage = await this.prisma.message.findFirst({
      where: {
        id: cursor,
        channelId
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    if (!cursorMessage) {
      throw new NotFoundException("Message not found");
    }

    return {
      OR: [{
        createdAt: {
          gt: cursorMessage.createdAt
        }
      }, {
        createdAt: cursorMessage.createdAt,
        id: {
          gt: cursorMessage.id
        }
      }]
    };
  }

  /**
   * If the message mentions a specific agent by name (not @AI/@All), return that agent; otherwise return null to use the default agent.
   */
  private async resolveMentionedAgent(workspaceId: string, content: string): Promise<Agent | null> {
    const mentionMatches = content.match(/@([^\s@]+)/g);

    if (!mentionMatches || mentionMatches.length === 0) {
      return null;
    }

    const mentionedNames = mentionMatches
      .map((mention) => mention.slice(1).trim())
      .filter((name) => name && name.toUpperCase() !== "AI" && name.toUpperCase() !== "ALL");

    if (mentionedNames.length === 0) {
      return null;
    }

    const agents = await this.prisma.agent.findMany({
      where: { workspaceId }
    });

    for (const name of mentionedNames) {
      const matchedAgent = agents.find((agent) => agent.name === name);

      if (matchedAgent) {
        return matchedAgent;
      }
    }

    return null;
  }

  private async resolveWorkspaceDefaultAgent(workspaceId: string): Promise<Agent | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { defaultAgentId: true }
    });

    if (!workspace?.defaultAgentId) {
      return null;
    }

    const agent = await this.prisma.agent.findFirst({
      where: { id: workspace.defaultAgentId, workspaceId }
    });

    return agent ?? null;
  }

  private async ensureDefaultAgent(workspaceId: string): Promise<Agent> {
    const existingAgent = await this.prisma.agent.findFirst({
      where: {
        workspaceId,
        isDefault: true
      },
      orderBy: { createdAt: "asc" }
    });

    if (existingAgent) {
      return existingAgent;
    }

    return this.prisma.agent.create({
      data: {
        workspaceId,
        name: "Workspace AI",
        type: AgentType.OPENAI_COMPATIBLE,
        engineType: "default-chat",
        isDefault: true
      }
    });
  }

  private markFailed(messageId: string, content: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        status: MessageStatus.FAILED,
        content
      }
    });
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "AI response failed";
  }

  private isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
  }

  private resolveAgentModel(agent: { providerConfigRef?: string | null } | null | undefined): string | null {
    if (!agent?.providerConfigRef) {
      return null;
    }
    try {
      const config = parseAgentProviderConfigRef(agent.providerConfigRef);
      return config.model ?? null;
    } catch {
      return null;
    }
  }

  private isConnectionError(message: string) {
    return /ECONNREFUSED|fetch failed|connect|network|unreachable/i.test(message);
  }
}

const HARNESS_START_HINT: Record<string, string> = {
  HERMES: "Start the Hermes harness first: hermes serve --port 9119",
  OPENCLAW: "Start the OpenClaw harness first: openclaw gateway",
  OLLAMA: "Start the local model first: ollama serve",
  OPENAI: "Check whether the API key configuration is valid",
  ANTHROPIC: "Check whether the API key configuration is valid"
};
