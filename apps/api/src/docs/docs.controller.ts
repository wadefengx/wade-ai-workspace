import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DocsService } from "./docs.service";

@ApiTags("docs-browser")
@Controller("docs")
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private readonly docsService: DocsService) {}

  @Get("specs")
  @ApiOperation({ summary: "获取 specs 文档列表" })
  @ApiBearerAuth()
  listSpecs() {
    return this.docsService.listSpecs();
  }

  @Get("specs/:name")
  @ApiOperation({ summary: "获取 spec 文档内容" })
  @ApiBearerAuth()
  getSpec(@Param("name") name: string) {
    return this.docsService.getSpec(name);
  }

  @Get("skills")
  @ApiOperation({ summary: "获取 skills 文档列表" })
  @ApiBearerAuth()
  listSkills() {
    return this.docsService.listSkills();
  }

  @Get("skills/:name")
  @ApiOperation({ summary: "获取 skill 文档内容" })
  @ApiBearerAuth()
  getSkill(@Param("name") name: string) {
    return this.docsService.getSkill(name);
  }
}
