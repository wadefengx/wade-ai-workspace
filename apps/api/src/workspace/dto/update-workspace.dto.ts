import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateWorkspaceDto {
  @ApiProperty({ description: "工作区名称", example: "Wade AI", required: true })
  @IsString({ message: "工作区名称必须是字符串" })
  @IsNotEmpty({ message: "工作区名称不能为空" })
  name!: string;

  @ApiPropertyOptional({ description: "工作区图标", example: "TeamOutlined" })
  @IsOptional()
  @IsString({ message: "工作区图标必须是字符串" })
  @MaxLength(50, { message: "工作区图标长度不能超过50个字符" })
  icon?: string;
}
