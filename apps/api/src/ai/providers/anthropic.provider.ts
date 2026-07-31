import { Injectable } from "@nestjs/common";
import { AIProvider, AIProviderStreamInput, ChatStreamEvent } from "./ai-provider";

type AnthropicEvent = {
  event?: string;
  data: string;
};

type AnthropicStreamChunk = {
  type?: string;
  error?: {
    message?: string;
  };
  delta?: {
    type?: string;
    text?: string;
  };
};

type ResolvedAnthropicConfig = {
  endpoint: string;
  headers: Record<string, string>;
  model: string;
};

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const DEFAULT_MAX_TOKENS = 1024;

@Injectable()
export class AnthropicProvider implements AIProvider {
  async *stream(input: AIProviderStreamInput): AsyncIterable<ChatStreamEvent> {
    const config = this.resolveConfig(input);
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: config.headers,
      body: JSON.stringify(this.buildRequestBody(input.messages, config.model)),
      signal: input.abortSignal
    });

    if (!response.ok) {
      throw new Error(await this.normalizeError(response));
    }

    if (!response.body) {
      throw new Error("Anthropic provider returned an empty response body");
    }

    for await (const event of this.readServerSentEvents(response.body)) {
      const payload = this.parseChunk(event.data);
      const errorMessage = payload.error?.message;

      if (errorMessage) {
        yield {
          type: "error",
          message: errorMessage
        };
        return;
      }

      if (event.event === "content_block_delta" && payload.delta?.type === "text_delta" && payload.delta.text) {
        yield {
          type: "token",
          content: payload.delta.text
        };
      }

      if (event.event === "message_stop" || payload.type === "message_stop") {
        yield { type: "done" };
        return;
      }
    }

    yield { type: "done" };
  }

  private resolveConfig(input: AIProviderStreamInput): ResolvedAnthropicConfig {
    const baseUrl = input.provider?.baseUrl?.replace(/\/$/, "")
      || process.env.ANTHROPIC_BASE_URL?.replace(/\/$/, "")
      || process.env.AI_PROVIDER_BASE_URL?.replace(/\/$/, "")
      || DEFAULT_ANTHROPIC_BASE_URL;
    const apiKey = input.provider?.apiKey || process.env.ANTHROPIC_API_KEY || process.env.AI_PROVIDER_API_KEY;
    const model = input.provider?.model || process.env.ANTHROPIC_MODEL || process.env.AI_PROVIDER_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const endpoint = baseUrl.endsWith("/messages")
      ? baseUrl
      : `${baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/messages`;

    return {
      endpoint,
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      model
    };
  }

  private buildRequestBody(messages: AIProviderStreamInput["messages"], model: string) {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join("\n\n");

    return {
      model,
      stream: true,
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS ?? DEFAULT_MAX_TOKENS),
      ...(system ? { system } : {}),
      messages: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: [{
            type: "text",
            text: message.content
          }]
        }))
    };
  }

  private parseChunk(eventData: string) {
    try {
      return JSON.parse(eventData) as AnthropicStreamChunk;
    } catch {
      throw new Error("Anthropic provider returned an invalid JSON chunk");
    }
  }

  private async normalizeError(response: Response) {
    const fallbackMessage = `Anthropic provider request failed with status ${response.status}`;
    const bodyText = await response.text();

    if (!bodyText) {
      return fallbackMessage;
    }

    try {
      const payload = JSON.parse(bodyText) as {
        error?: { message?: string };
        message?: string;
      };

      return payload.error?.message ?? payload.message ?? bodyText;
    } catch {
      return bodyText;
    }
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
        const event = this.extractEvent(frame);

        if (event) {
          yield event;
        }
      }
    }

    buffer += decoder.decode();
    const trailingEvent = this.extractEvent(buffer);

    if (trailingEvent) {
      yield trailingEvent;
    }
  }

  private extractEvent(frame: string) {
    const lines = frame.split(/\r?\n/);
    const event = lines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (!data) {
      return null;
    }

    return {
      event,
      data
    } satisfies AnthropicEvent;
  }
}
