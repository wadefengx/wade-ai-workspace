import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Get service health status" })
  async getHealth() {
    await this.prisma.$runCommandRaw({ ping: 1 });
    // ponytail: Ollama is optional rather than required; health checks only verify the database, and the Agents page displays Ollama status.
    return { status: "ok" };
  }
}
