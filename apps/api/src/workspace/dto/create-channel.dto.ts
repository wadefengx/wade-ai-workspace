import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateChannelDto {
  @ApiProperty({ description: "频道名称", example: "engineering", required: true })
  @IsString({ message: "频道名称必须是字符串" })
  @IsNotEmpty({ message: "频道名称不能为空" })
  name!: string;
}
