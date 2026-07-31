import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { StatsService } from "./stats.service";

@ApiTags("stats")
@Controller("stats")
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get("organization")
  @ApiOperation({ summary: "获取组织仪表盘统计" })
  @ApiBearerAuth()
  getOrganizationStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statsService.getOrganizationStats(user.id, user.role);
  }

  @Get("feedback")
  @ApiOperation({ summary: "获取消息反馈统计" })
  @ApiBearerAuth()
  getFeedbackStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statsService.getFeedbackStats(user.id, user.role);
  }
}
