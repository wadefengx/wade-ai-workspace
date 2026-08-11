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
  @ApiOperation({ summary: "Get organization dashboard statistics" })
  @ApiBearerAuth()
  getOrganizationStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statsService.getOrganizationStats(user.id, user.role);
  }

  @Get("feedback")
  @ApiOperation({ summary: "Get message feedback statistics" })
  @ApiBearerAuth()
  getFeedbackStats(@CurrentUser() user: AuthenticatedUser) {
    return this.statsService.getFeedbackStats(user.id, user.role);
  }
}
