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
  @ApiOperation({ summary: "Get specs document list" })
  @ApiBearerAuth()
  listSpecs() {
    return this.docsService.listSpecs();
  }

  @Get("specs/:name")
  @ApiOperation({ summary: "Get spec document content" })
  @ApiBearerAuth()
  getSpec(@Param("name") name: string) {
    return this.docsService.getSpec(name);
  }

  @Get("skills")
  @ApiOperation({ summary: "Get skills document list" })
  @ApiBearerAuth()
  listSkills() {
    return this.docsService.listSkills();
  }

  @Get("skills/:name")
  @ApiOperation({ summary: "Get skill document content" })
  @ApiBearerAuth()
  getSkill(@Param("name") name: string) {
    return this.docsService.getSkill(name);
  }
}
