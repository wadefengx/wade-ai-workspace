import { ApiProperty } from "@nestjs/swagger";
import { AgentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

class CreateAgentProviderConfigDto {
  @ApiProperty({ description: "Provider 基础地址", example: "http://127.0.0.1:11434/v1", required: false })
  @IsOptional()
  @IsString({ message: "baseUrl 必须是字符串" })
  baseUrl?: string;

  @ApiProperty({ description: "Provider API Key", example: "sk-demo-key", required: false })
  @IsOptional()
  @IsString({ message: "apiKey 必须是字符串" })
  apiKey?: string;

  @ApiProperty({ description: "Provider 模型名称", example: "claude-3-5-sonnet-latest", required: false })
  @IsOptional()
  @IsString({ message: "model 必须是字符串" })
  model?: string;
}

export class CreateAgentDto {
  @ApiProperty({ description: "Agent 展示名称", example: "Claude Agent", required: true })
  @IsString({ message: "名称必须是字符串" })
  @MinLength(1, { message: "名称不能为空" })
  name!: string;

  @ApiProperty({
    description: "Agent 类型",
    example: AgentType.ANTHROPIC,
    required: true,
    enum: AgentType
  })
  @IsEnum(AgentType, { message: "Agent 类型不合法" })
  type!: AgentType;

  @ApiProperty({
    description: "Agent Provider 配置",
    required: false,
    type: CreateAgentProviderConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAgentProviderConfigDto)
  providerConfig?: CreateAgentProviderConfigDto;

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

  @ApiProperty({ description: "harness 运行环境", example: "OLLAMA", required: false })
  @IsOptional()
  @IsString({ message: "harness 必须是字符串" })
  harness?: string;

  @ApiProperty({ description: "Embedding 模型名称，留空跟随 chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingModel 必须是字符串" })
  embeddingModel?: string;

  @ApiProperty({ description: "Embedding baseUrl，留空跟随 chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingBaseUrl 必须是字符串" })
  embeddingBaseUrl?: string;
}
