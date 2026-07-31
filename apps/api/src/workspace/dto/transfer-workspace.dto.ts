import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class TransferWorkspaceDto {
  @ApiProperty({ description: "目标用户 ID", example: "6890f0dff9d0b5a26a000002", required: true })
  @IsString({ message: "目标用户 ID 必须是字符串" })
  @MinLength(1, { message: "目标用户不能为空" })
  toUserId!: string;
}
