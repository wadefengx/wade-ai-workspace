import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ description: "用户姓名", example: "Wade", required: true })
  @IsString()
  @IsNotEmpty({ message: "姓名不能为空" })
  name!: string;

  @ApiProperty({ description: "登录邮箱", example: "wade@example.com", required: true })
  @IsEmail({}, { message: "邮箱格式不正确" })
  email!: string;

  @ApiProperty({ description: "登录密码", example: "password123", required: true })
  @IsString()
  @MinLength(8, { message: "密码至少需要 8 位" })
  password!: string;
}
