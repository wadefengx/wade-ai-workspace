import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.$runCommandRaw({
      update: "Agent",
      updates: [{
        q: {
          type: {
            $exists: false
          },
          providerConfigRef: null
        },
        u: {
          $set: {
            type: "OLLAMA"
          }
        },
        multi: true
      }, {
        q: {
          type: {
            $exists: false
          }
        },
        u: {
          $set: {
            type: "OPENAI_COMPATIBLE"
          }
        },
        multi: true
      }]
    });
    this.logger.log("Connected to database");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Disconnected from database");
  }
}
