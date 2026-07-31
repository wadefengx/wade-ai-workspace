import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class UpdateWorkspaceDto {
  @ApiProperty({ description: "工作区名称", example: "Zone AI", required: true })
  @IsString({ message: "工作区名称必须是字符串" })
  @IsNotEmpty({ message: "工作区名称不能为空" })
  name!: string;
}
