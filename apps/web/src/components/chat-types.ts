export type MessageSenderType = "USER" | "AGENT";
export type MessageStatus = "PENDING" | "STREAMING" | "COMPLETED" | "FAILED";
export type MessageFeedback = "like" | "dislike" | null;

export type Citation = {
  index: number;
  filename: string;
  chunkIndex: number;
  content: string;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  status: MessageStatus;
  createdAt: string;
  feedback?: MessageFeedback;
};

export type LocalChatMessage = ChatMessage & {
  errorMessage?: string;
  optimistic?: boolean;
  persistedId?: string;
  requestContent?: string;
  thinkingContent?: string;
  agentName?: string | null;
  modelName?: string | null;
  harness?: string | null;
  citations?: Citation[];
};

export type ChannelMessagesResponse = {
  items: ChatMessage[];
  nextCursor: string | null;
};

export type StreamEventPayload = {
  type: "token" | "done" | "error" | "reasoning" | "thinking" | "citations" | string;
  content?: string;
  messageId?: string;
  message?: string;
  reasoning?: string;
  reasoning_content?: string;
  thinking?: string;
  agent?: string;
  agentName?: string;
  model?: string;
  harness?: string;
  citations?: Citation[];
};

export type StreamStatusState = {
  channelId: string;
  agentName: string;
  modelName: string | null;
};
