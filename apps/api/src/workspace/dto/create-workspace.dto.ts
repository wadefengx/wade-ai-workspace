import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateWorkspaceDto {
  @ApiProperty({ description: "工作区名称", example: "Team Alpha", required: true })
  @IsString()
  @IsNotEmpty({ message: "工作区名称不能为空" })
  name!: string;
}
