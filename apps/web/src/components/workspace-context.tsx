"use client";

import { createContext, useContext, type ReactNode } from "react";
import { apiFetch, unwrapItems } from "../lib/api";

export type Workspace = {
  id: string;
  name: string;
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
};

export const workspaceKeys = {
  all: ["workspaces"] as const,
  channels: (workspaceId: string | null) => ["workspaces", workspaceId, "channels"] as const,
  members: (workspaceId: string | null) => ["workspaces", workspaceId, "members"] as const
};

export async function fetchWorkspaces() {
  return unwrapItems(await apiFetch<Workspace[] | { items: Workspace[] }>("/workspaces"));
}

export async function fetchChannels(workspaceId: string) {
  return unwrapItems(await apiFetch<Channel[] | { items: Channel[] }>(`/workspaces/${workspaceId}/channels`));
}

export async function fetchMembers(workspaceId: string) {
  return unwrapItems(await apiFetch<Member[] | { items: Member[] }>(`/workspaces/${workspaceId}/members`));
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("WorkspaceContext is missing");
  }

  return context;
}

export const useWorkspacePageContext = useWorkspaceContext;
