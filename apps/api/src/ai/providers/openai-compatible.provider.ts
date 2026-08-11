import { Injectable } from "@nestjs/common";
import {
  AIProvider,
  AIProviderStreamInput,
  ChatStreamEvent,
  createProviderRequestSignal
} from "./ai-provider";

type OpenAIStreamChunk = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

type ResolvedProviderConfig = {
  endpoint: string;
  headers: Record<string, string>;
  model: string;
};

const DEFAULT_OLLAMA_BASE_URL = "http://ollama:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  async *stream(input: AIProviderStreamInput): AsyncIterable<ChatStreamEvent> {
    const config = this.resolveConfig(input);
    let response: Response;

    try {
      response = await fetch(config.endpoint, {
        method: "POST",
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          stream: true,
          messages: input.messages
        }),
        signal: createProviderRequestSignal(input.abortSignal)
      });
    } catch {
      throw new Error("AI provider request failed");
    }

    if (!response.ok) {
      throw new Error(this.errorMessageForStatus(response.status));
    }

    if (!response.body) {
      throw new Error("AI provider returned an empty response body");
    }

    for await (const eventData of this.readServerSentEvents(response.body)) {
      if (eventData === "[DONE]") {
        yield { type: "done" };
        return;
      }

      const payload = this.parseChunk(eventData);
      if (payload.error?.message) {
        yield {
          type: "error",
          message: "AI provider request failed"
        };
        return;
      }

      const content = this.readDeltaContent(payload);

      if (content) {
        yield {
          type: "token",
          content
        };
      }

      if (payload.choices?.[0]?.finish_reason) {
        yield { type: "done" };
        return;
      }
    }

    yield { type: "done" };
  }

  private resolveConfig(input: AIProviderStreamInput): ResolvedProviderConfig {
    const baseUrl = input.provider?.baseUrl?.replace(/\/$/, "") || process.env.AI_PROVIDER_BASE_URL?.replace(/\/$/, "");
    const model = input.provider?.model
      || process.env.AI_PROVIDER_MODEL
      || process.env.OLLAMA_CHAT_MODEL
      || DEFAULT_OLLAMA_MODEL;
    const apiKey = input.provider?.apiKey || process.env.AI_PROVIDER_API_KEY;
    const endpoint = baseUrl
      ? (baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`)
      : `${(process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "")}/v1/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return {
      endpoint,
      headers,
      model
    };
  }

  private parseChunk(eventData: string) {
    try {
      return JSON.parse(eventData) as OpenAIStreamChunk;
    } catch {
      throw new Error("AI provider returned an invalid JSON chunk");
    }
  }

  private readDeltaContent(payload: OpenAIStreamChunk) {
    const content = payload.choices?.[0]?.delta?.content;

    if (typeof content === "string") {
      return content;
    }

    if (!Array.isArray(content)) {
      return "";
    }

    return content
      .map((part) => part.text ?? "")
      .join("");
  }

  private errorMessageForStatus(status: number) {
    if (status === 401 || status === 403) {
      return `AI provider authentication failed (status ${status})`;
    }

    if (status === 408 || status === 504) {
      return `AI provider request timed out (status ${status})`;
    }

    if (status === 429) {
      return `AI provider rate limit reached (status ${status})`;
    }

    if (status >= 500) {
      return `AI provider is temporarily unavailable (status ${status})`;
    }

    return `AI provider request failed (status ${status})`;
  }

  private async *readServerSentEvents(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const eventData = this.extractData(frame);

        if (eventData) {
          yield eventData;
        }
      }
    }

    buffer += decoder.decode();
    const trailingData = this.extractData(buffer);

    if (trailingData) {
      yield trailingData;
    }
  }

  private extractData(frame: string) {
    return frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
  }
}
