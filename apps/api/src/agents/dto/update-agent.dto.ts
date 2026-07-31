import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

class UpdateAgentProviderConfigDto {
  @ApiProperty({ description: "Provider 基础地址", example: "http://127.0.0.1:11434/v1", required: false })
  @IsOptional()
  @IsString({ message: "baseUrl 必须是字符串" })
  baseUrl?: string;

  @ApiProperty({ description: "Provider API Key", example: "sk-demo-key", required: false })
  @IsOptional()
  @IsString({ message: "apiKey 必须是字符串" })
  apiKey?: string;

  @ApiProperty({ description: "Provider 模型名称", example: "qwen3:8b", required: false })
  @IsOptional()
  @IsString({ message: "model 必须是字符串" })
  model?: string;
}

export class UpdateAgentDto {
  @ApiProperty({ description: "Agent 展示名称", example: "Workspace AI", required: false })
  @IsOptional()
  @IsString({ message: "名称必须是字符串" })
  @MinLength(1, { message: "名称不能为空" })
  name?: string;

  @ApiProperty({
    description: "Agent Provider 配置补丁",
    example: {
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen3:8b"
    },
    required: false,
    type: UpdateAgentProviderConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAgentProviderConfigDto)
  providerConfig?: UpdateAgentProviderConfigDto;
}
