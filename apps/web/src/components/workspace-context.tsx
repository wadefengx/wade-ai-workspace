"use client";

import { createContext, useContext, type ReactNode } from "react";
import { apiFetch, unwrapItems } from "../lib/api";

export type Workspace = {
  id: string;
  name: string;
  icon?: string | null;
  defaultAgentId?: string | null;
  createdAt?: string;
};

export type Channel = {
  id: string;
  name: string;
  createdAt?: string;
  lastMessageAt?: string | null;
  messageCount?: number;
};

export type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  avatarUrl?: string | null;
};

export type AgentSummary = {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  emoji?: string | null;
  role?: string | null;
  description?: string | null;
  systemPrompt?: string | null;
  harness?: string;
};

export type WorkspaceContextValue = {
  workspaceId: string | null;
  workspaces: Workspace[];
  workspacesLoading: boolean;
  selectedWorkspace: Workspace | null;
  channels: Channel[];
  channelsLoading: boolean;
  selectedChannelId: string | null;
  selectedChannel: Channel | null;
  members: Member[];
  membersLoading: boolean;
  agents: AgentSummary[];
  agentsLoading: boolean;
};

export const workspaceKeys = {
  all: ["workspaces"] as const,
  channels: (workspaceId: string | null) => ["workspaces", workspaceId, "channels"] as const,
  members: (workspaceId: string | null) => ["workspaces", workspaceId, "members"] as const,
  agents: (workspaceId: string | null) => ["workspaces", workspaceId, "agents"] as const
};

type CreateWorkspaceInput = {
  name: string;
  icon?: string | null;
};

type CreateChannelInput = {
  name: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function requestWorkspaces() {
  return unwrapItems(await apiFetch<Workspace[] | { items: Workspace[] }>("/workspaces"));
}

async function requestChannels(workspaceId: string) {
  return unwrapItems(await apiFetch<Channel[] | { items: Channel[] }>(`/workspaces/${workspaceId}/channels`));
}

async function requestMembers(workspaceId: string) {
  return unwrapItems(await apiFetch<Member[] | { items: Member[] }>(`/workspaces/${workspaceId}/members`));
}

async function requestAgents(workspaceId: string) {
  return unwrapItems(await apiFetch<AgentSummary[] | { items: AgentSummary[] }>(`/workspaces/${workspaceId}/agents`));
}

async function requestCreateWorkspace({ name, icon }: CreateWorkspaceInput) {
  return apiFetch<Workspace>("/workspaces", {
    method: "POST",
    body: {
      name,
      icon: icon ?? null
    }
  });
}

async function requestCreateChannel(workspaceId: string, { name }: CreateChannelInput) {
  return apiFetch<Channel>(`/workspaces/${workspaceId}/channels`, {
    method: "POST",
    body: { name }
  });
}

export async function fetchWorkspaces() {
  return requestWorkspaces();
}

export async function fetchChannels(workspaceId: string) {
  return requestChannels(workspaceId);
}

export async function fetchMembers(workspaceId: string) {
  return requestMembers(workspaceId);
}

export async function fetchAgents(workspaceId: string) {
  return requestAgents(workspaceId);
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  return requestCreateWorkspace(input);
}

export async function createChannel(workspaceId: string, input: CreateChannelInput) {
  return requestCreateChannel(workspaceId, input);
}

export function WorkspaceContextProvider({
  children,
  value
}: {
  children: ReactNode;
  value: WorkspaceContextValue;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("WorkspaceContext is missing");
  }
  return value;
}

export const useWorkspacePageContext = useWorkspaceContext;
