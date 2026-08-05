import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmbeddingService } from "../ai/embedding.service";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { KnowledgeRepository } from "../repositories/knowledge.repository";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeRepository, WorkspaceMemberGuard, EmbeddingService],
  exports: [KnowledgeRepository, KnowledgeService]
})
export class KnowledgeModule {}
