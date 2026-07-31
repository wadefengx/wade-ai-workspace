import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { MemoryController } from "./memory.controller";
import { MemoryService } from "./memory.service";

@Module({
  imports: [AuthModule],
  controllers: [MemoryController],
  providers: [MemoryService, WorkspaceMemberGuard],
  exports: [MemoryService]
})
export class MemoryModule {}
