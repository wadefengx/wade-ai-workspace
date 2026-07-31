import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ description: "登录邮箱", example: "admin@wade.local", required: true })
  @IsEmail({}, { message: "邮箱格式不正确" })
  email!: string;

  @ApiProperty({ description: "登录密码", example: "admin", required: true })
  @IsString()
  @IsNotEmpty({ message: "密码不能为空" })
  password!: string;
}
