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
  @ApiOperation({ summary: "Get workspace agents" })
  @ApiBearerAuth()
  listWorkspaceAgents(@Param("workspaceId") workspaceId: string) {
    return this.agentsService.listWorkspaceAgents(workspaceId);
  }

  @Post("workspaces/:workspaceId/agents")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "Create a workspace agent" })
  @ApiBearerAuth()
  createAgent(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAgentDto
  ) {
    return this.agentsService.createAgent(workspaceId, user.id, dto);
  }

  @Patch("agents/:agentId")
  @ApiOperation({ summary: "Update agent configuration" })
  @ApiBearerAuth()
  updateAgent(
    @Param("agentId") agentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAgentDto
  ) {
    return this.agentsService.updateAgent(agentId, user.id, dto);
  }

  @Post("agents/:agentId/test")
  @ApiOperation({ summary: "Test the agent provider connection" })
  @ApiBearerAuth()
  testConnection(@Param("agentId") agentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.testConnection(agentId, user.id);
  }

  @Delete("agents/:agentId")
  @ApiOperation({ summary: "Delete an agent" })
  @ApiBearerAuth()
  deleteAgent(@Param("agentId") agentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.agentsService.deleteAgent(agentId, user.id);
  }
}
