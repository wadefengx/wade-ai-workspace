import { Module } from "@nestjs/common";
import { AgentsModule } from "./agents/agents.module";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { DocsModule } from "./docs/docs.module";
import { HealthController } from "./health.controller";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MemoryModule } from "./memory/memory.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    UsersModule,
    AgentsModule,
    AiModule,
    ChatModule,
    DocsModule,
    KnowledgeModule,
    MemoryModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
