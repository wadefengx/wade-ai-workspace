import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({
    description: "刷新令牌",
    example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    required: true
  })
  @IsString({ message: "refreshToken 必须是字符串" })
  @IsNotEmpty({ message: "refreshToken 不能为空" })
  refreshToken!: string;
}
