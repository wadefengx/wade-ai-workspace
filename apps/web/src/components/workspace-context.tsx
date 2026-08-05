"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createStore, type StoreApi } from "zustand/vanilla";
import { apiFetch, unwrapItems } from "../lib/api";

export type Workspace = {
  id: string;
  name: string;
  icon?: string | null;
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

type WorkspaceStoreState = {
  workspaces: Workspace[];
  members: Member[];
  channels: Channel[];
  agents: AgentSummary[];
  workspaceId: string | null;
  selectedChannelId: string | null;
  workspacesLoading: boolean;
  membersLoading: boolean;
  channelsLoading: boolean;
  agentsLoading: boolean;
  fetchWorkspaces: () => Promise<Workspace[]>;
  fetchMembers: (workspaceId: string) => Promise<Member[]>;
  fetchChannels: (workspaceId: string) => Promise<Channel[]>;
  fetchAgents: (workspaceId: string) => Promise<AgentSummary[]>;
  selectWorkspace: (workspaceId: string | null) => void;
  selectChannel: (channelId: string | null) => void;
  createWorkspace: (input: CreateWorkspaceInput) => Promise<Workspace>;
  createChannel: (workspaceId: string, input: CreateChannelInput) => Promise<Channel>;
  invalidate: (scope?: "all" | "workspaces" | "members" | "channels" | "agents") => void;
  sync: (value: WorkspaceContextValue) => void;
};

type WorkspaceStore = StoreApi<WorkspaceStoreState>;

const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

function resolveWorkspaceId(workspaces: Workspace[], workspaceId: string | null) {
  if (!workspaces.length) {
    return null;
  }

  return workspaces.some((workspace) => workspace.id === workspaceId) ? workspaceId : workspaces[0].id;
}

function resolveChannelId(channels: Channel[], channelId: string | null) {
  if (!channels.length) {
    return null;
  }

  return channels.some((channel) => channel.id === channelId) ? channelId : channels[0].id;
}

function pickStoreFields(value: WorkspaceContextValue) {
  return {
    workspaces: value.workspaces,
    members: value.members,
    channels: value.channels,
    agents: value.agents,
    workspaceId: value.workspaceId,
    selectedChannelId: value.selectedChannelId,
    workspacesLoading: value.workspacesLoading,
    membersLoading: value.membersLoading,
    channelsLoading: value.channelsLoading,
    agentsLoading: value.agentsLoading
  };
}

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

function createWorkspaceContextStore(initialValue: WorkspaceContextValue) {
  return createStore<WorkspaceStoreState>((set, get) => ({
    ...pickStoreFields(initialValue),
    async fetchWorkspaces() {
      set({ workspacesLoading: true });

      try {
        const workspaces = await requestWorkspaces();
        const workspaceId = resolveWorkspaceId(workspaces, get().workspaceId);
        set({ workspaces, workspaceId, workspacesLoading: false });
        return workspaces;
      } catch (error) {
        set({ workspacesLoading: false });
        throw error;
      }
    },
    async fetchMembers(workspaceId) {
      set({ membersLoading: true });

      try {
        const members = await requestMembers(workspaceId);
        set({ members, membersLoading: false });
        return members;
      } catch (error) {
        set({ membersLoading: false });
        throw error;
      }
    },
    async fetchAgents(workspaceId) {
      set({ agentsLoading: true });

      try {
        const agents = await requestAgents(workspaceId);
        set({ agents, agentsLoading: false });
        return agents;
      } catch (error) {
        set({ agentsLoading: false });
        throw error;
      }
    },
    async fetchChannels(workspaceId) {
      set({ channelsLoading: true });

      try {
        const channels = await requestChannels(workspaceId);
        const selectedChannelId = resolveChannelId(channels, get().selectedChannelId);
        set({ channels, selectedChannelId, channelsLoading: false });
        return channels;
      } catch (error) {
        set({ channelsLoading: false });
        throw error;
      }
    },
    selectWorkspace(workspaceId) {
      set({ workspaceId });
    },
    selectChannel(selectedChannelId) {
      set({ selectedChannelId });
    },
    async createWorkspace(input) {
      const workspace = await requestCreateWorkspace(input);
      set((state) => ({
        workspaces: [...state.workspaces, workspace],
        workspaceId: workspace.id
      }));
      return workspace;
    },
    async createChannel(workspaceId, input) {
      const channel = await requestCreateChannel(workspaceId, input);
      set((state) => ({
        channels: [...state.channels, channel],
        selectedChannelId: channel.id
      }));
      return channel;
    },
    invalidate(scope = "all") {
      if (scope === "workspaces") {
        set({ workspaces: [], workspacesLoading: false });
        return;
      }

      if (scope === "members") {
        set({ members: [], membersLoading: false });
        return;
      }

      if (scope === "channels") {
        set({ channels: [], selectedChannelId: null, channelsLoading: false });
        return;
      }

      if (scope === "agents") {
        set({ agents: [], agentsLoading: false });
        return;
      }

      set({
        workspaces: [],
        members: [],
        channels: [],
        agents: [],
        workspaceId: null,
        selectedChannelId: null,
        workspacesLoading: false,
        membersLoading: false,
        channelsLoading: false,
        agentsLoading: false
      });
    },
    sync(value) {
      set(pickStoreFields(value));
    }
  }));
}

export function WorkspaceContextProvider({
  children,
  value
}: {
  children: ReactNode;
  value: WorkspaceContextValue;
}) {
  const [store] = useState(() => createWorkspaceContextStore(value));

  useEffect(() => {
    store.getState().sync(value);
  }, [store, value]);

  return <WorkspaceStoreContext.Provider value={store}>{children}</WorkspaceStoreContext.Provider>;
}

export function useWorkspaceContext() {
  const store = useContext(WorkspaceStoreContext);

  if (!store) {
    throw new Error("WorkspaceContext is missing");
  }

  // zustand v5:selector 必须返回稳定引用,否则 useSyncExternalStore 无限循环
  return useStore(store, useShallow((state) => ({
    workspaceId: state.workspaceId,
    workspaces: state.workspaces,
    workspacesLoading: state.workspacesLoading,
    selectedWorkspace: state.workspaces.find((workspace) => workspace.id === state.workspaceId) ?? null,
    channels: state.channels,
    channelsLoading: state.channelsLoading,
    selectedChannelId: state.selectedChannelId,
    selectedChannel: state.channels.find((channel) => channel.id === state.selectedChannelId) ?? null,
    members: state.members,
    membersLoading: state.membersLoading,
    agents: state.agents,
    agentsLoading: state.agentsLoading
  })));
}

export const useWorkspacePageContext = useWorkspaceContext;
