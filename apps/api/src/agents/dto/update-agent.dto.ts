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

  @ApiProperty({ description: "专家 emoji 头像", example: "🧠", required: false })
  @IsOptional()
  @IsString({ message: "emoji 必须是字符串" })
  emoji?: string;

  @ApiProperty({ description: "专家角色名", example: "资深前端工程师", required: false })
  @IsOptional()
  @IsString({ message: "role 必须是字符串" })
  role?: string;

  @ApiProperty({ description: "专家能力描述", example: "擅长 React/性能优化", required: false })
  @IsOptional()
  @IsString({ message: "description 必须是字符串" })
  description?: string;

  @ApiProperty({ description: "专家 system prompt", required: false })
  @IsOptional()
  @IsString({ message: "systemPrompt 必须是字符串" })
  systemPrompt?: string;
}
