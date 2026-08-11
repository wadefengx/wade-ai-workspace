import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateChannelDto {
  @ApiProperty({ description: "Channel name", example: "engineering", required: true })
  @IsString({ message: "channel name must be a string" })
  @IsNotEmpty({ message: "channel name must not be empty" })
  name!: string;
}
