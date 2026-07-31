import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateMessageDto {
  @ApiProperty({ description: "消息内容", example: "@AI 介绍一下这个工作区", required: true })
  @IsString()
  @IsNotEmpty({ message: "消息内容不能为空" })
  content!: string;
}
