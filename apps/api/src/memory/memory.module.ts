import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { ChannelMemberGuard } from "../common/guards/channel-member.guard";
import { EmbeddingService } from "../ai/embedding.service";
import { AI_PROVIDER } from "../ai/providers/ai-provider";
import { OpenAICompatibleProvider } from "../ai/providers/openai-compatible.provider";
import { MemoryController } from "./memory.controller";
import { MemoryService } from "./memory.service";

@Module({
  imports: [AuthModule],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    WorkspaceMemberGuard,
    ChannelMemberGuard,
    EmbeddingService,
    OpenAICompatibleProvider,
    {
      provide: AI_PROVIDER,
      useExisting: OpenAICompatibleProvider
    }
  ],
  exports: [MemoryService]
})
export class MemoryModule {}
