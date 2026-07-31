import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
