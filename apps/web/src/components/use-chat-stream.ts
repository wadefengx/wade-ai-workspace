"use client";

import { useCallback, useState } from "react";
import type { LocalChatMessage } from "./chat-types";

/**
 * Keeps optimistic chat messages in one reusable state boundary. The caller
 * owns transport details so this hook can also serve non-SSE chat surfaces.
 */
export function useChatStream() {
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);

  const removeLocalMessage = useCallback((messageId: string) => {
    setLocalMessages((current) => current.filter((item) => item.id !== messageId));
  }, []);

  const patchLocalMessage = useCallback(
    (messageId: string, updater: (message: LocalChatMessage) => LocalChatMessage) => {
      setLocalMessages((current) => current.map((item) => (item.id === messageId ? updater(item) : item)));
    },
    []
  );

  return { localMessages, setLocalMessages, removeLocalMessage, patchLocalMessage };
}
