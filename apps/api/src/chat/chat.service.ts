import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Agent, MessageStatus, MessageSenderType } from "@prisma/client";
import { AGENT_ENGINE, AgentEngine } from "../ai/engines/agent-engine";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ListChannelMessagesQueryDto } from "./dto/list-channel-messages-query.dto";

export type ChatSseEvent =
  | {
      type: "token";
      content: string;
    }
  | {
      type: "done";
      messageId: string;
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

  async *streamAgentReply(input: StreamAgentReplyInput): AsyncIterable<ChatSseEvent> {
    const agent = await this.ensureDefaultAgent(input.workspaceId);
    await this.createMessage(input.workspaceId, input.channelId, input.userId, {
      content: input.content
    });

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
        messageId: agentMessage.id
      };
    } catch (error) {
      await this.markFailed(agentMessage.id, fullContent);

      if (input.abortSignal?.aborted || this.isAbortError(error)) {
        return;
      }

      yield {
        type: "error",
        message: this.normalizeError(error)
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
      throw new NotFoundException("消息不存在");
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

    return "AI 回复失败";
  }

  private isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
  }
}
