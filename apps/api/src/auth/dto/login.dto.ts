import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({ description: "Sign-in email", example: "admin@wade.local", required: true })
  @IsEmail({}, { message: "Invalid email address format" })
  email!: string;

  @ApiProperty({ description: "Sign-in password", example: "admin", required: true })
  @IsString({ message: "password must be a string" })
  @IsNotEmpty({ message: "password must not be empty" })
  password!: string;
}
