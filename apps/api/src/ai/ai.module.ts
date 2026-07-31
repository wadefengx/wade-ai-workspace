import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { MemoryModule } from "../memory/memory.module";
import { OllamaService } from "../ollama.service";
import { PrismaModule } from "../prisma/prisma.module";
import { DefaultChatEngine } from "./engines/default-chat.engine";
import { AGENT_ENGINE } from "./engines/agent-engine";
import { AI_PROVIDER } from "./providers/ai-provider";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.provider";

@Module({
  imports: [PrismaModule, KnowledgeModule, MemoryModule],
  providers: [
    OllamaService,
    OpenAICompatibleProvider,
    DefaultChatEngine,
    {
      provide: AI_PROVIDER,
      useExisting: OpenAICompatibleProvider
    },
    {
      provide: AGENT_ENGINE,
      useExisting: DefaultChatEngine
    }
  ],
  exports: [AI_PROVIDER, AGENT_ENGINE, DefaultChatEngine, OllamaService]
})
export class AiModule {}
