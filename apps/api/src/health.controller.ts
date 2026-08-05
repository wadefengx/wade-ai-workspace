import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "./prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "获取服务健康状态" })
  async getHealth() {
    await this.prisma.$runCommandRaw({ ping: 1 });
    // ponytail: ollama 已从必需依赖降级为可选 LLM,健康检查只看 DB;ollama 状态由 Agents 页展示
    return { status: "ok" };
  }
}
