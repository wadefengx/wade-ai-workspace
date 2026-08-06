import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";
import { AgentsService } from "./agents.service";

@ApiTags("agents")
@Controller()
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get("workspaces/:workspaceId/agents")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "获取工作区 Agent 列表" })
  @ApiBearerAuth()
  listWorkspaceAgents(@Param("workspaceId") workspaceId: string) {
    return this.agentsService.listWorkspaceAgents(workspaceId);
  }

  @Post("workspaces/:workspaceId/agents")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "创建工作区 Agent" })
  @ApiBearerAuth()
  createAgent(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAgentDto
  ) {
    return this.agentsService.createAgent(workspaceId, user.id, dto);
  }

  @Patch("agents/:agentId")
  @ApiOperation({ summary: "更新 Agent 配置" })
  @ApiBearerAuth()
  updateAgent(
    @Param("agentId") agentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAgentDto
  ) {
    return this.agentsService.updateAgent(agentId, user.id, dto);
  }

  @Post("agents/:agentId/test")
  @ApiOperation({ summary: "测试 Agent Provider 连接" })
  @ApiBearerAuth()
  testConnection(@Param("agentId") agentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.testConnection(agentId, user.id);
  }

  @Delete("agents/:agentId")
  @ApiOperation({ summary: "删除 Agent" })
  @ApiBearerAuth()
  deleteAgent(@Param("agentId") agentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.deleteAgent(agentId, user.id);
  }
}
