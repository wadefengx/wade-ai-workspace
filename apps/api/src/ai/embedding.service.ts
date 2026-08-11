import { Injectable, Logger } from "@nestjs/common";

export type EmbeddingProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

const DEFAULT_OLLAMA_BASE_URL = "http://ollama:11434";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // ponytail: strip anything matching the configured key so an echoing endpoint can't leak it into logs.
  private redact(text: string, apiKey?: string) {
    const truncated = text.slice(0, 500);
    return apiKey ? truncated.split(apiKey).join("[REDACTED]") : truncated;
  }

  async embed(input: string, config?: EmbeddingProviderConfig): Promise<number[] | null> {
    try {
      if (config?.baseUrl && config?.apiKey) {
        return await this.embedViaOpenAICompatible(input, config);
      }

      return await this.embedViaOllama(input, config);
    } catch (error) {
      this.logger.warn(`Embedding failed, degrading gracefully: ${this.normalizeError(error)}`);
      return null;
    }
  }

  private async embedViaOpenAICompatible(input: string, config: EmbeddingProviderConfig) {
    const baseUrl = config.baseUrl!.replace(/\/$/, "");
    const endpoint = baseUrl.endsWith("/embeddings") ? baseUrl : `${baseUrl}/embeddings`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model ?? DEFAULT_OPENAI_EMBEDDING_MODEL,
        input
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(this.redact(body, config.apiKey) || `Embedding request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embedding = payload.data?.[0]?.embedding;

    if (!embedding || embedding.length === 0) {
      throw new Error("Embedding provider returned an empty embedding");
    }

    return embedding;
  }

  private async embedViaOllama(input: string, config?: EmbeddingProviderConfig) {
    const baseUrl = (config?.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
    const model = config?.model || process.env.OLLAMA_EMBEDDING_MODEL || DEFAULT_OLLAMA_EMBEDDING_MODEL;
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input
      })
    });

    if (!response.ok) {
      throw new Error(await response.text() || `Ollama embed request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      embeddings?: number[][];
      embedding?: number[];
    };
    const embedding = payload.embeddings?.[0] ?? payload.embedding;

    if (!embedding || embedding.length === 0) {
      throw new Error("Ollama embed returned an empty embedding");
    }

    return embedding;
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "unknown error";
  }
}
