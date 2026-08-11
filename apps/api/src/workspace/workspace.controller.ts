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
  @ApiOperation({ summary: "Get workspaces visible to the current user" })
  @ApiBearerAuth()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listForUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a workspace" })
  @ApiBearerAuth()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.createWorkspace(user.id, dto);
  }

  @Patch(":workspaceId")
  @ApiOperation({ summary: "Update workspace information" })
  @ApiBearerAuth()
  updateWorkspace(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceDto
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, user.id, dto);
  }

  @Post(":workspaceId/transfer")
  @ApiOperation({ summary: "Transfer workspace ownership" })
  @ApiBearerAuth()
  transferOwnership(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferWorkspaceDto
  ) {
    return this.workspaceService.transferOwnership(workspaceId, user.id, dto);
  }

  @Delete(":workspaceId")
  @ApiOperation({ summary: "Delete a workspace" })
  @ApiBearerAuth()
  deleteWorkspace(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.deleteWorkspace(workspaceId, user.id);
  }

  @Get(":workspaceId/members")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Get workspace members" })
  @ApiBearerAuth()
  listMembers(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listMembers(workspaceId, user.id);
  }

  @Get(":workspaceId/channels")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Get workspace channels" })
  @ApiBearerAuth()
  listChannels(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listChannels(workspaceId, user.id);
  }

  @Post(":workspaceId/channels")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Create a workspace channel" })
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
  @ApiOperation({ summary: "Add a workspace member" })
  @ApiBearerAuth()
  addMember(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemberDto
  ) {
    return this.workspaceService.addMember(workspaceId, user.id, dto);
  }
}
