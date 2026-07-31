import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateMemoryDto {
  @ApiProperty({ description: "更新后的记忆内容", example: "客户偏好双周报使用中文输出。", required: false })
  @IsOptional()
  @IsString({ message: "记忆内容必须是字符串" })
  @IsNotEmpty({ message: "记忆内容不能为空" })
  content?: string;

  @ApiProperty({ description: "是否启用该记忆", example: true, required: false })
  @IsOptional()
  @IsBoolean({ message: "enabled 必须为布尔值" })
  enabled?: boolean;
}
