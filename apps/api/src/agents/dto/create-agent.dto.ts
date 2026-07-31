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
}
