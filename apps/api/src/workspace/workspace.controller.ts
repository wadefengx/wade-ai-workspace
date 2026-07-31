import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CreateChannelDto } from "./dto/create-channel.dto";
import { CreateMemberDto } from "./dto/create-member.dto";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { TransferWorkspaceDto } from "./dto/transfer-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { WorkspaceService } from "./workspace.service";

@ApiTags("workspaces")
@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  @ApiOperation({ summary: "获取当前用户可见工作区" })
  @ApiBearerAuth()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: "创建工作区" })
  @ApiBearerAuth()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.createWorkspace(user.id, dto);
  }

  @Patch(":workspaceId")
  @ApiOperation({ summary: "更新工作区信息" })
  @ApiBearerAuth()
  updateWorkspace(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceDto
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, user.id, dto);
  }

  @Post(":workspaceId/transfer")
  @ApiOperation({ summary: "转交工作区 OWNER" })
  @ApiBearerAuth()
  transferOwnership(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferWorkspaceDto
  ) {
    return this.workspaceService.transferOwnership(workspaceId, user.id, dto);
  }

  @Delete(":workspaceId")
  @ApiOperation({ summary: "删除工作区" })
  @ApiBearerAuth()
  deleteWorkspace(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.deleteWorkspace(workspaceId, user.id);
  }

  @Get(":workspaceId/members")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "获取工作区成员列表" })
  @ApiBearerAuth()
  listMembers(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listMembers(workspaceId, user.id);
  }

  @Get(":workspaceId/channels")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "获取工作区频道列表" })
  @ApiBearerAuth()
  listChannels(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listChannels(workspaceId, user.id);
  }

  @Post(":workspaceId/channels")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "创建工作区频道" })
  @ApiBearerAuth()
  createChannel(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChannelDto
  ) {
    return this.workspaceService.createChannel(workspaceId, user.id, dto);
  }

  @Post(":workspaceId/members")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "添加工作区成员" })
  @ApiBearerAuth()
  addMember(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemberDto
  ) {
    return this.workspaceService.addMember(workspaceId, user.id, dto);
  }
}
