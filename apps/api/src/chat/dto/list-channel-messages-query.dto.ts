import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListChannelMessagesQueryDto {
  @ApiProperty({ description: "Pagination cursor message ID", example: "6890c1f2a8d5f503f6b0d123", required: false })
  @IsOptional()
  @IsString({ message: "cursor must be a string" })
  cursor?: string;

  @ApiProperty({ description: "Messages per request", example: 20, required: false })
  @Type(() => Number)
  @IsInt({ message: "limit must be an integer" })
  @Min(1, { message: "limit must not be less than 1" })
  @Max(100, { message: "limit must not be greater than 100" })
  limit = 20;
}
