import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WorkspaceMemberGuard } from "../common/guards/workspace-member.guard";
import { AuthenticatedUser } from "../common/types/authenticated-user";
import { UpdateKnowledgeDocumentDto } from "./dto/update-knowledge-document.dto";
import { KnowledgeService, UploadedKnowledgeFile } from "./knowledge.service";

@ApiTags("knowledge")
@Controller()
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post("workspaces/:workspaceId/knowledge")
  @UseGuards(WorkspaceMemberGuard)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "上传知识文档" })
  @ApiBearerAuth()
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary"
        }
      }
    }
  })
  uploadDocument(
    @Param("workspaceId") workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedKnowledgeFile
  ) {
    return this.knowledgeService.uploadDocument(workspaceId, user.id, file);
  }

  @Get("workspaces/:workspaceId/knowledge")
  @UseGuards(WorkspaceMemberGuard)
  @ApiOperation({ summary: "获取知识文档列表" })
  @ApiBearerAuth()
  listDocuments(@Param("workspaceId") workspaceId: string) {
    return this.knowledgeService.listDocuments(workspaceId);
  }

  @Patch("knowledge/:documentId")
  @ApiOperation({ summary: "更新知识文档名称" })
  @ApiBearerAuth()
  updateName(
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateKnowledgeDocumentDto
  ) {
    return this.knowledgeService.updateName(documentId, user.id, dto);
  }

  @Post("knowledge/:documentId/reindex")
  @ApiOperation({ summary: "重新索引知识文档" })
  @ApiBearerAuth()
  reindexDocument(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeService.reindexDocument(documentId, user.id);
  }

  @Delete("knowledge/:documentId")
  @ApiOperation({ summary: "删除知识文档" })
  @ApiBearerAuth()
  deleteDocument(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeService.deleteDocument(documentId, user.id);
  }
}
