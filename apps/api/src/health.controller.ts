import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { OllamaService } from "./ollama.service";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaService
  ) {}

  @Get()
  @ApiOperation({ summary: "获取服务健康状态" })
  async getHealth() {
    await this.prisma.$runCommandRaw({ ping: 1 });
    await this.ollama.assertAvailable();
    return { status: "ok" };
  }
}
