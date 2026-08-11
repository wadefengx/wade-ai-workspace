import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  ChannelAccessRequest,
  ChannelMemberGuard,
  requireChannelAccess
} from "../common/guards/channel-member.guard";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CreateMemoryDto } from "./dto/create-memory.dto";
import { UpdateMemoryDto } from "./dto/update-memory.dto";
import { MemoryService } from "./memory.service";

@ApiTags("memory")
@Controller()
@UseGuards(JwtAuthGuard)
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get("workspaces/:workspaceId/memories")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Get workspace memories" })
  @ApiBearerAuth()
  listMemories(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.memoryService.listVisibleMemories(workspaceId, user.id);
  }

  @Post("workspaces/:workspaceId/memories")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Create a workspace memory" })
  @ApiBearerAuth()
  createMemory(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemoryDto
  ) {
    return this.memoryService.createMemory(workspaceId, user.id, dto);
  }

  @Patch("memories/:memoryId")
  @ApiOperation({ summary: "Update a memory" })
  @ApiBearerAuth()
  updateMemory(
    @Param("memoryId") memoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemoryDto
  ) {
    return this.memoryService.updateMemory(memoryId, user.id, dto);
  }

  @Delete("memories/:memoryId")
  @ApiOperation({ summary: "Delete a memory" })
  @ApiBearerAuth()
  deleteMemory(@Param("memoryId") memoryId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.memoryService.deleteMemory(memoryId, user.id);
  }

  @Post("channels/:channelId/memories/extract")
  @UseGuards(ChannelMemberGuard)
  @ApiOperation({ summary: "Extract layered memories from channel conversations (L1 atomic → L2 scenarios)" })
  @ApiBearerAuth()
  extractFromConversation(
    @Req() request: ChannelAccessRequest,
    @Param("channelId") channelId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    const channelAccess = requireChannelAccess(request);

    return this.memoryService.extractFromConversation(channelAccess.workspaceId, channelId, user.id);
  }
}
