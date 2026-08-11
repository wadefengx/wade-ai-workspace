import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, MinLength, ValidateNested } from "class-validator";

class UpdateAgentProviderConfigDto {
  @ApiProperty({ description: "Provider base URL", example: "http://127.0.0.1:11434/v1", required: false })
  @IsOptional()
  @IsString({ message: "baseUrl must be a string" })
  baseUrl?: string;

  @ApiProperty({ description: "Provider API Key", example: "sk-demo-key", required: false })
  @IsOptional()
  @IsString({ message: "apiKey must be a string" })
  apiKey?: string;

  @ApiProperty({ description: "Provider model name", example: "qwen3:8b", required: false })
  @IsOptional()
  @IsString({ message: "model must be a string" })
  model?: string;
}

export class UpdateAgentDto {
  @ApiProperty({ description: "Harness runtime environment", example: "OLLAMA", required: false })
  @IsOptional()
  @IsString({ message: "harness must be a string" })
  harness?: string;
  @ApiProperty({ description: "Agent display name", example: "Workspace AI", required: false })
  @IsOptional()
  @IsString({ message: "name must be a string" })
  @MinLength(1, { message: "name must not be empty" })
  name?: string;

  @ApiProperty({
    description: "Agent provider configuration patch",
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

  @ApiProperty({ description: "Embedding model name; leave empty to use the chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingModel must be a string" })
  embeddingModel?: string;

  @ApiProperty({ description: "Embedding baseUrl; leave empty to use the chat provider", required: false })
  @IsOptional()
  @IsString({ message: "embeddingBaseUrl must be a string" })
  embeddingBaseUrl?: string;
}
