import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";

@Module({
  imports: [AuthModule],
  controllers: [AgentsController],
  providers: [AgentsService, WorkspaceMemberGuard]
})
export class AgentsModule {}
