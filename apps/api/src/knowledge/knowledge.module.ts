import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { OllamaService } from "../ollama.service";
import { KnowledgeRepository } from "../repositories/knowledge.repository";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeRepository, WorkspaceMemberGuard, OllamaService],
  exports: [KnowledgeRepository, KnowledgeService]
})
export class KnowledgeModule {}
