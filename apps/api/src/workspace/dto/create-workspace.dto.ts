import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ description: "工作区名称", example: "Team Alpha", required: true })
  @IsString()
  @IsNotEmpty({ message: "工作区名称不能为空" })
  name!: string;

  @ApiPropertyOptional({ description: "工作区图标", example: "TeamOutlined" })
  @IsOptional()
  @IsString({ message: "工作区图标必须是字符串" })
  @MaxLength(50, { message: "工作区图标长度不能超过50个字符" })
  icon?: string;
}
