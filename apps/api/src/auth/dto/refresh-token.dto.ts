import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
    example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    required: true
  })
  @IsString({ message: "refreshToken must be a string" })
  @IsNotEmpty({ message: "refreshToken must not be empty" })
  refreshToken!: string;
}
