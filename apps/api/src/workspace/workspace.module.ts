import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceController } from "./workspace.controller";
import { MembersController } from "./members.controller";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceController, MembersController],
  providers: [WorkspaceService, WorkspaceMemberGuard]
})
export class WorkspaceModule {}
