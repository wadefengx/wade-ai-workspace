import { Injectable, ServiceUnavailableException } from "@nestjs/common";

const DEFAULT_OLLAMA_BASE_URL = "http://ollama:11434";
const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";

@Injectable()
export class OllamaService {
  async assertAvailable() {
    const response = await fetch(`${this.resolveBaseUrl()}/api/tags`);

    if (!response.ok) {
      throw new ServiceUnavailableException("Ollama is unavailable");
    }
  }

  async embed(input: string) {
    const response = await fetch(`${this.resolveBaseUrl()}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_OLLAMA_EMBEDDING_MODEL,
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

  private resolveBaseUrl() {
    return (process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
  }
}
