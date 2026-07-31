"use client";

import { create } from "zustand";
import { ApiError, apiFetch, setAccessTokenGetter, setSessionRefreshHandler, setUnauthorizedHandler } from "../lib/api";

const LEGACY_TOKEN_STORAGE_KEY = "wade-ai-workspace-token";
const SESSION_STORAGE_KEY = "zone-ai-session";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type SessionPayload = {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  user: AuthUser;
};

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  isRestoring: boolean;
  initialize: () => Promise<void>;
  setSession: (payload: SessionPayload) => void;
  setTokens: (payload: { accessToken: string; refreshToken: string }) => void;
  clearSession: () => void;
};

let initializePromise: Promise<void> | null = null;

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;

    if (
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      !isAuthUser(parsed.user)
    ) {
      return null;
    }

    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function hasLegacyToken() {
  if (typeof window === "undefined") {
    return false;
  }

  return !!window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
}

function writeStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function resolveAccessToken(payload: Pick<SessionPayload, "accessToken" | "token">) {
  return payload.accessToken ?? payload.token ?? null;
}

function buildStoredSession(payload: SessionPayload): StoredSession | null {
  const accessToken = resolveAccessToken(payload);

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken: payload.refreshToken ?? "",
    user: payload.user
  };
}

function applyStoredSession(set: (partial: Partial<AuthState>) => void, session: StoredSession | null) {
  set({
    token: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    user: session?.user ?? null,
    hydrated: true,
    isRestoring: false
  });
}

async function refreshSessionTokens() {
  const state = useAuthStore.getState();
  const storedSession = readStoredSession();
  const refreshToken = state.refreshToken ?? storedSession?.refreshToken ?? "";
  const user = state.user ?? storedSession?.user ?? null;

  if (!refreshToken || !user) {
    return false;
  }

  try {
    const nextSession = await apiFetch<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      auth: false,
      body: { refreshToken }
    });

    state.setTokens(nextSession);
    return true;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  isRestoring: false,
  async initialize() {
    if (get().hydrated) {
      return;
    }

    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      const storedSession = readStoredSession();

      if (!storedSession) {
        if (hasLegacyToken()) {
          set({ hydrated: true, isRestoring: false, token: null, refreshToken: null, user: null });
          return;
        }

        set({ hydrated: true, isRestoring: false, token: null, refreshToken: null, user: null });
        return;
      }

      set({
        token: storedSession.accessToken,
        refreshToken: storedSession.refreshToken,
        user: storedSession.user,
        isRestoring: true
      });

      try {
        const response = await apiFetch<AuthUser>("/auth/me", {
          autoRefresh: false
        });
        get().setSession({
          accessToken: storedSession.accessToken,
          refreshToken: storedSession.refreshToken,
          user: response
        });
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 401) {
          applyStoredSession(set, storedSession);
          return;
        }
      }

      const refreshed = await refreshSessionTokens();

      if (!refreshed) {
        get().clearSession();
        return;
      }

      try {
        const response = await apiFetch<AuthUser>("/auth/me", {
          autoRefresh: false
        });
        get().setSession({
          accessToken: get().token ?? undefined,
          refreshToken: get().refreshToken ?? undefined,
          user: response
        });
      } catch {
        get().clearSession();
      }
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },
  setSession(payload) {
    const session = buildStoredSession(payload);
    writeStoredSession(session);
    set({
      token: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      user: session?.user ?? null,
      hydrated: true,
      isRestoring: false
    });
  },
  setTokens({ accessToken, refreshToken }) {
    const currentUser = get().user ?? readStoredSession()?.user;
    if (!currentUser) {
      return;
    }

    const session = {
      accessToken,
      refreshToken,
      user: currentUser
    };
    writeStoredSession(session);
    set({
      token: accessToken,
      refreshToken,
      user: currentUser,
      hydrated: true,
      isRestoring: false
    });
  },
  clearSession() {
    writeStoredSession(null);
    set({
      token: null,
      refreshToken: null,
      user: null,
      hydrated: true,
      isRestoring: false
    });
  }
}));

setAccessTokenGetter(() => useAuthStore.getState().token ?? readStoredSession()?.accessToken ?? null);
setSessionRefreshHandler(refreshSessionTokens);
setUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});
