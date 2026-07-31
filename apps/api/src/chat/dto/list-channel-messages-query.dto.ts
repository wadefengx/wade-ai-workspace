import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListChannelMessagesQueryDto {
  @ApiProperty({ description: "分页游标消息 ID", example: "6890c1f2a8d5f503f6b0d123", required: false })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ description: "单次拉取消息条数", example: 20, required: false })
  @Type(() => Number)
  @IsInt({ message: "limit 必须是整数" })
  @Min(1, { message: "limit 不能小于 1" })
  @Max(100, { message: "limit 不能大于 100" })
  limit = 20;
}
