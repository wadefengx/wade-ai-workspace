import { ApiProperty } from "@nestjs/swagger";
import { MemoryLevel, MemoryType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateMemoryDto {
  @ApiProperty({ description: "Memory type", example: MemoryType.TEAM, required: true, enum: MemoryType })
  @IsEnum(MemoryType, { message: "Invalid memory type" })
  type!: MemoryType;

  @ApiProperty({ description: "Memory level", example: MemoryLevel.L1_ATOM, required: false, enum: MemoryLevel })
  @IsOptional()
  @IsEnum(MemoryLevel, { message: "Invalid memory level" })
  level?: MemoryLevel;

  @ApiProperty({ description: "Memory content", example: "The customer prefers weekly reports in Chinese.", required: true })
  @IsString({ message: "memory content must be a string" })
  @IsNotEmpty({ message: "memory content must not be empty" })
  content!: string;
}
