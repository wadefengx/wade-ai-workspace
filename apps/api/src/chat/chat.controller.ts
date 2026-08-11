import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import {
  ChannelAccessRequest,
  ChannelMemberGuard,
  requireChannelAccess
} from "../common/guards/channel-member.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { ChatService, ChatSseEvent } from "./chat.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ListChannelMessagesQueryDto } from "./dto/list-channel-messages-query.dto";
import { UpdateMessageFeedbackDto } from "./dto/update-message-feedback.dto";

type RequestEventName = "aborted" | "close";

type StreamingRequest = ChannelAccessRequest & {
  on(event: RequestEventName, listener: () => void): void;
  off(event: RequestEventName, listener: () => void): void;
};

type StreamingResponse = {
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
};

@ApiTags("chat")
@Controller("channels")
@UseGuards(JwtAuthGuard, ChannelMemberGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(":channelId/messages")
  @ApiOperation({ summary: "Get channel messages" })
  @ApiBearerAuth()
  listMessages(
    @Req() request: ChannelAccessRequest,
    @Param("channelId") channelId: string,
    @Query() query: ListChannelMessagesQueryDto
  ) {
    const channelAccess = requireChannelAccess(request);

    return this.chatService.listMessages(channelAccess.workspaceId, channelId, query);
  }

  @Post(":channelId/messages")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Send a channel message" })
  @ApiBearerAuth()
  createMessage(
    @Req() request: ChannelAccessRequest,
    @Param("channelId") channelId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMessageDto
  ) {
    const channelAccess = requireChannelAccess(request);

    return this.chatService.createMessage(channelAccess.workspaceId, channelId, user.id, dto);
  }

  @Patch(":channelId/messages/:messageId/feedback")
  @ApiOperation({ summary: "Update message feedback" })
  @ApiBearerAuth()
  updateMessageFeedback(
    @Req() request: ChannelAccessRequest,
    @Param("channelId") channelId: string,
    @Param("messageId") messageId: string,
    @Body() dto: UpdateMessageFeedbackDto
  ) {
    const channelAccess = requireChannelAccess(request);

    return this.chatService.updateMessageFeedback(
      channelAccess.workspaceId,
      channelId,
      messageId,
      dto
    );
  }

  @Post(":channelId/generate-title")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate a conversation title with the model and update the channel name" })
  @ApiBearerAuth()
  generateChannelTitle(
    @Req() request: ChannelAccessRequest,
    @Param("channelId") channelId: string
  ) {
    const channelAccess = requireChannelAccess(request);

    return this.chatService.generateChannelTitle(channelAccess.workspaceId, channelId);
  }

  @Post(":channelId/ai/stream")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stream an AI response" })
  @ApiBearerAuth()
  async streamAiReply(
    @Req() request: StreamingRequest,
    @Param("channelId") channelId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMessageDto,
    @Res() response: StreamingResponse
  ) {
    const channelAccess = requireChannelAccess(request);
    const abortController = new AbortController();
    let finished = false;
    const handleDisconnect = () => {
      if (finished) {
        return;
      }

      abortController.abort();
    };

    request.on("aborted", handleDisconnect);
    request.on("close", handleDisconnect);
    this.prepareSseResponse(response);

    try {
      for await (const event of this.chatService.streamAgentReply({
        workspaceId: channelAccess.workspaceId,
        channelId,
        userId: user.id,
        content: dto.content,
        abortSignal: abortController.signal
      })) {
        if (abortController.signal.aborted || response.writableEnded) {
          break;
        }

        this.writeSseEvent(response, event);
      }
    } catch (error) {
      if (!abortController.signal.aborted && !response.writableEnded) {
        this.writeSseEvent(response, {
          type: "error",
          message: error instanceof Error ? error.message : "AI response failed"
        });
      }
    } finally {
      finished = true;
      request.off("aborted", handleDisconnect);
      request.off("close", handleDisconnect);

      if (!response.writableEnded) {
        response.end();
      }
    }
  }

  private prepareSseResponse(response: StreamingResponse) {
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
  }

  private writeSseEvent(response: StreamingResponse, event: ChatSseEvent) {
    response.write("event: message\n");
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}
