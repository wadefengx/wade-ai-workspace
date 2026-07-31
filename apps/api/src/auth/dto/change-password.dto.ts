import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ description: "当前密码", example: "old-password", required: true })
  @IsString({ message: "当前密码必须是字符串" })
  @MinLength(1, { message: "当前密码不能为空" })
  currentPassword!: string;

  @ApiProperty({ description: "新密码", example: "new-password-123", required: true })
  @IsString({ message: "新密码必须是字符串" })
  @MinLength(6, { message: "新密码长度不能少于 6 位" })
  newPassword!: string;
}
