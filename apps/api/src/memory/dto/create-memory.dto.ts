import { ApiProperty } from "@nestjs/swagger";
import { MemoryType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class CreateMemoryDto {
  @ApiProperty({ description: "记忆类型", example: MemoryType.TEAM, required: true, enum: MemoryType })
  @IsEnum(MemoryType, { message: "记忆类型不合法" })
  type!: MemoryType;

  @ApiProperty({ description: "记忆内容", example: "客户偏好周报使用中文输出。", required: true })
  @IsString({ message: "记忆内容必须是字符串" })
  @IsNotEmpty({ message: "记忆内容不能为空" })
  content!: string;
}
