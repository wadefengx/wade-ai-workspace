import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AgentsModule } from "./agents/agents.module";
import { AiModule } from "./ai/ai.module";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { DocsModule } from "./docs/docs.module";
import { HealthController } from "./health.controller";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { MemoryModule } from "./memory/memory.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StatsModule } from "./stats/stats.module";
import { UsersModule } from "./users/users.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{
        ttl: 60_000,
        limit: 100
      }]
    }),
    PrismaModule,
    AuthModule,
    WorkspaceModule,
    UsersModule,
    AgentsModule,
    AiModule,
    ChatModule,
    DocsModule,
    KnowledgeModule,
    MemoryModule,
    StatsModule
  ],
  controllers: [HealthController],
  providers: [{
    provide: APP_GUARD,
    useClass: ThrottlerGuard
  }]
})
export class AppModule {}
