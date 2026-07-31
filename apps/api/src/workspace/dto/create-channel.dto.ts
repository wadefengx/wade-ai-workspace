import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateChannelDto {
  @ApiProperty({ description: "频道名称", example: "engineering", required: true })
  @IsString()
  @IsNotEmpty({ message: "频道名称不能为空" })
  name!: string;
}
