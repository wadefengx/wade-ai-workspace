import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateMessageDto {
  @ApiProperty({ description: "Message content", example: "@AI introduce this workspace", required: true })
  @IsString({ message: "message content must be a string" })
  @IsNotEmpty({ message: "message content must not be empty" })
  content!: string;
}
