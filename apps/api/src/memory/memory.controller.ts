import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
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
  @ApiOperation({ summary: "获取工作区记忆列表" })
  @ApiBearerAuth()
  listMemories(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.memoryService.listVisibleMemories(workspaceId, user.id);
  }

  @Post("workspaces/:workspaceId/memories")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "创建工作区记忆" })
  @ApiBearerAuth()
  createMemory(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemoryDto
  ) {
    return this.memoryService.createMemory(workspaceId, user.id, dto);
  }

  @Patch("memories/:memoryId")
  @ApiOperation({ summary: "更新记忆" })
  @ApiBearerAuth()
  updateMemory(
    @Param("memoryId") memoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemoryDto
  ) {
    return this.memoryService.updateMemory(memoryId, user.id, dto);
  }

  @Delete("memories/:memoryId")
  @ApiOperation({ summary: "删除记忆" })
  @ApiBearerAuth()
  deleteMemory(@Param("memoryId") memoryId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.memoryService.deleteMemory(memoryId, user.id);
  }
}
