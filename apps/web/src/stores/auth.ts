"use client";

import { create } from "zustand";
import { apiFetch, setAccessTokenGetter, setUnauthorizedHandler } from "../lib/api";

const TOKEN_STORAGE_KEY = "wade-ai-workspace-token";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  isRestoring: boolean;
  initialize: () => Promise<void>;
  setSession: (payload: { token: string; user: AuthUser }) => void;
  clearSession: () => void;
};

let initializePromise: Promise<void> | null = null;

function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function writeStoredToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
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
      const token = readStoredToken();

      if (!token) {
        set({ hydrated: true, isRestoring: false, token: null, user: null });
        return;
      }

      set({ token, isRestoring: true });

      try {
        const response = await apiFetch<{ user: AuthUser }>("/auth/me");
        set({
          token,
          user: response.user,
          hydrated: true,
          isRestoring: false
        });
      } catch {
        get().clearSession();
      }
    })().finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },
  setSession({ token, user }) {
    writeStoredToken(token);
    set({
      token,
      user,
      hydrated: true,
      isRestoring: false
    });
  },
  clearSession() {
    writeStoredToken(null);
    set({
      token: null,
      user: null,
      hydrated: true,
      isRestoring: false
    });
  }
}));

setAccessTokenGetter(() => useAuthStore.getState().token ?? readStoredToken());
setUnauthorizedHandler(() => {
  useAuthStore.getState().clearSession();
});
