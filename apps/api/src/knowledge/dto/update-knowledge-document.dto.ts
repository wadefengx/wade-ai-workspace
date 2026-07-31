import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateKnowledgeDocumentDto {
  @ApiProperty({ description: "知识文档名称", example: "SPEC-phase8.md", required: true })
  @IsString({ message: "文档名称必须是字符串" })
  @IsNotEmpty({ message: "文档名称不能为空" })
  name!: string;
}
