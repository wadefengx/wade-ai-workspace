import { ApiProperty } from "@nestjs/swagger";
import { AgentType } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

class CreateAgentProviderConfigDto {
  @ApiProperty({ description: "Provider base URL", example: "http://127.0.0.1:11434/v1", required: false })
  @IsOptional()
  @IsString({ message: "baseUrl must be a string" })
  baseUrl?: string;

  @ApiProperty({ description: "Provider API Key", example: "sk-demo-key", required: false })
  @IsOptional()
  @IsString({ message: "apiKey must be a string" })
  apiKey?: string;

  @ApiProperty({ description: "Provider model name", example: "claude-3-5-sonnet-latest", required: false })
  @IsOptional()
  @IsString({ message: "model must be a string" })
  model?: string;
}

export class CreateAgentDto {
  @ApiProperty({ description: "Agent display name", example: "Claude Agent", required: true })
  @IsString({ message: "name must be a string" })
  @MinLength(1, { message: "name must not be empty" })
  name!: string;

  @ApiProperty({
    description: "Agent type",
    example: AgentType.ANTHROPIC,
    required: true,
    enum: AgentType
  })
  @IsEnum(AgentType, { message: "Invalid agent type" })
  type!: AgentType;

  @ApiProperty({
    description: "Agent provider configuration",
    required: false,
    type: CreateAgentProviderConfigDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAgentProviderConfigDto)
  providerConfig?: CreateAgentProviderConfigDto;

  @ApiProperty({ description: "Expert emoji avatar", example: "🧠", required: false })
  @IsOptional()
  @IsString({ message: "emoji must be a string" })
  emoji?: string;

  @ApiProperty({ description: "Expert role name", example: "Senior frontend engineer", required: false })
  @IsOptional()
  @IsString({ message: "role must be a string" })
  role?: string;

  @ApiProperty({ description: "Expert capability description", example: "Skilled in React and performance optimization", required: false })
  @IsOptional()
  @IsString({ message: "description must be a string" })
  description?: string;

  @ApiProperty({ description: "Expert system prompt", required: false })
  @IsOptional()
  @IsString({ message: "systemPrompt must be a string" })
  systemPrompt?: string;

  @ApiProperty({ description: "Harness runtime environment", example: "OLLAMA", required: false })
  @IsOptional()
  @IsString({ message: "harness must be a string" })
  harness?: string;

  @ApiProperty({ description: "Embedding model name; leave empty to use the chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingModel must be a string" })
  embeddingModel?: string;

  @ApiProperty({ description: "Embedding baseUrl; leave empty to use the chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingBaseUrl must be a string" })
  embeddingBaseUrl?: string;
}
