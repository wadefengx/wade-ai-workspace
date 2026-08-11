import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ description: "User name", example: "Wade", required: true })
  @IsString({ message: "name must be a string" })
  @IsNotEmpty({ message: "name must not be empty" })
  name!: string;

  @ApiProperty({ description: "Sign-in email", example: "wade@example.com", required: true })
  @IsEmail({}, { message: "Invalid email address format" })
  email!: string;

  @ApiProperty({ description: "Sign-in password", example: "password123", required: true })
  @IsString({ message: "password must be a string" })
  @MinLength(8, { message: "password must be at least 8 characters long" })
  password!: string;
}
