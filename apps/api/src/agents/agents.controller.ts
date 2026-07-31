import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
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
}
