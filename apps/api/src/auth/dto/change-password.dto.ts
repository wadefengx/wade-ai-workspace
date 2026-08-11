import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ description: "Current password", example: "old-password", required: true })
  @IsString({ message: "current password must be a string" })
  @MinLength(1, { message: "current password must not be empty" })
  currentPassword!: string;

  @ApiProperty({ description: "New password", example: "new-password-123", required: true })
  @IsString({ message: "new password must be a string" })
  @MinLength(6, { message: "new password must be at least 6 characters long" })
  newPassword!: string;
}
