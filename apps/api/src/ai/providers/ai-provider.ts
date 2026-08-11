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

const PROVIDER_REQUEST_TIMEOUT_MS = 30_000;

export function createProviderRequestSignal(inputSignal?: AbortSignal) {
    const timeoutSignal = AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS);

    return inputSignal
      ? AbortSignal.any([inputSignal, timeoutSignal])
      : timeoutSignal;
}

export interface AIProvider {
  stream(input: AIProviderStreamInput): AsyncIterable<ChatStreamEvent>;
}

export const AI_PROVIDER = Symbol("AI_PROVIDER");
