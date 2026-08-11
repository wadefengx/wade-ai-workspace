import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateKnowledgeDocumentDto {
  @ApiProperty({ description: "Knowledge document name", example: "SPEC-phase8.md", required: true })
  @IsString({ message: "document name must be a string" })
  @IsNotEmpty({ message: "document name must not be empty" })
  name!: string;
}
