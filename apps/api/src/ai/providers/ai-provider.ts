export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProviderStreamInput = {
  messages: ChatCompletionMessage[];
  abortSignal?: AbortSignal;
  provider?: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
};

export type ChatCitation = {
  index: number;
  filename: string;
  chunkIndex: number;
  content: string;
};

export type ChatStreamEvent =
  | {
      type: "token";
      content: string;
    }
  | {
      type: "citations";
      citations: ChatCitation[];
    }
  | {
      type: "done";
    }
  | {
      type: "error";
      message: string;
    };

export interface AIProvider {
  stream(input: AIProviderStreamInput): AsyncIterable<ChatStreamEvent>;
}

export const AI_PROVIDER = Symbol("AI_PROVIDER");
