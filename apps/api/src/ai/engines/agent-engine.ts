import { ChatStreamEvent } from "../providers/ai-provider";

export type AgentExecutionInput = {
  workspaceId: string;
  channelId: string;
  userId: string;
  latestUserMessage?: string;
  abortSignal?: AbortSignal;
};

export type AgentCapability = {
  name: string;
  description: string;
};

export interface AgentEngine {
  stream(input: AgentExecutionInput): AsyncIterable<ChatStreamEvent>;
  getCapabilities(): AgentCapability[];
}

export const AGENT_ENGINE = Symbol("AGENT_ENGINE");
