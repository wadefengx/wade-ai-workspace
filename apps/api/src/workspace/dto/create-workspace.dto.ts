import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ description: "Workspace name", example: "Team Alpha", required: true })
  @IsString({ message: "workspace name must be a string" })
  @IsNotEmpty({ message: "workspace name must not be empty" })
  name!: string;

  @ApiPropertyOptional({ description: "Workspace icon", example: "TeamOutlined" })
  @IsOptional()
  @IsString({ message: "workspace icon must be a string" })
  @MaxLength(50, { message: "workspace icon must not exceed 50 characters" })
  icon?: string;
}
