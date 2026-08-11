import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateMemoryDto {
  @ApiProperty({ description: "Updated memory content", example: "The customer prefers biweekly reports in Chinese.", required: false })
  @IsOptional()
  @IsString({ message: "memory content must be a string" })
  @IsNotEmpty({ message: "memory content must not be empty" })
  content?: string;

  @ApiProperty({ description: "Whether this memory is enabled", example: true, required: false })
  @IsOptional()
  @IsBoolean({ message: "enabled must be a boolean" })
  enabled?: boolean;
}
