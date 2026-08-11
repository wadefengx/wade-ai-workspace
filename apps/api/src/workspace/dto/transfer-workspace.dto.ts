import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class TransferWorkspaceDto {
  @ApiProperty({ description: "Target user ID", example: "6890f0dff9d0b5a26a000002", required: true })
  @IsString({ message: "target user ID must be a string" })
  @MinLength(1, { message: "target user must not be empty" })
  toUserId!: string;
}
