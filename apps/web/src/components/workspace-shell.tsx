"use client";

import {
  CopyOutlined,
  DislikeOutlined,
  LoadingOutlined,
  MessageOutlined,
  PlusOutlined,
  RedoOutlined,
  RobotOutlined,
  SmileOutlined,
  LikeOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Grid, Popover, Tag, Tooltip, Typography } from "antd";
import { Bubble, Sender, Suggestion } from "@ant-design/x";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef
} from "react";
import { FullScreenSpinner } from "./auth-status";
import { useWorkspaceContext, workspaceKeys, type AgentSummary } from "./workspace-context";
import { ApiError, apiFetch, resolveApiUrl } from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { streamSse } from "../lib/sse";
import { useAuthStore } from "../stores/auth";
import {
  type ChannelMessagesResponse,
  type ChatMessage,
  type LocalChatMessage,
  type MessageFeedback,
  type StreamEventPayload,
  type StreamStatusState
} from "./chat-types";
import { useChatStream } from "./use-chat-stream";
import { Composer } from "./composer";
import { MessageList } from "./message-list";
import styles from "./workspace-shell.module.css";
import { EmptyState, LoadingState } from "./ui-state";

type FeedbackMutationVariables = {
  channelId: string;
  messageId: string;
  requestedType: Exclude<MessageFeedback, null>;
  nextFeedback: MessageFeedback;
  previousFeedback: MessageFeedback;
};

const PAGE_SIZE = 20;
const RETRY_DUPLICATE_WINDOW_MS = 60_000;

// Common emoji (lightweight built-in panel; no emoji library)
const EMOJIS = [
  "😀", "😄", "😂", "🤣", "😊", "😍", "😘", "🤔",
  "😅", "😎", "🙌", "👍", "👏", "💪", "🔥", "✨",
  "🎉", "❤️", "💯", "🚀", "🎯", "✅", "🙏", "😴"
];

const chatKeys = {
  messages: (channelId: string | null) => ["channels", channelId, "messages"] as const
};

async function fetchChannelMessages(channelId: string, cursor?: string | null) {
  const searchParams = new URLSearchParams({ limit: String(PAGE_SIZE) });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return apiFetch<ChannelMessagesResponse>(`/channels/${channelId}/messages?${searchParams.toString()}`);
}

function compareMessages(a: Pick<ChatMessage, "createdAt" | "id">, b: Pick<ChatMessage, "createdAt" | "id">) {
  const timestampDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return a.id.localeCompare(b.id);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.channelId === "string" &&
    (candidate.senderType === "USER" || candidate.senderType === "AGENT") &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function formatMessageTime(createdAt: string) {
  return formatDateTime(createdAt);
}

function isNearBottom(element: HTMLDivElement, threshold = 100) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
}

function appendStreamText(current: string | undefined, next: string) {
  return current ? `${current}${next}` : next;
}

function pickFirstString(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

/**
 * Determines whether a message should trigger a streaming AI response:
 * - Contains @<agent name> (matching an agent) → trigger; backend replies with that agent.
 * - Contains @AI or no @ mention → trigger the default agent.
 * - Contains only @<member name> (not AI or an agent) → do not trigger; only save the message.
 */
function resolveShouldTriggerAi(content: string, agents: AgentSummary[], members: { name: string }[]) {
  const mentionMatches = content.match(/@([^\s@]+)/g);

  if (!mentionMatches || mentionMatches.length === 0) {
    return true;
  }

  const mentionedNames = mentionMatches.map((mention) => mention.slice(1));

  if (mentionedNames.some((name) => name.toUpperCase() === "AI")) {
    return true;
  }

  if (mentionedNames.some((name) => agents.some((agent) => agent.name === name))) {
    return true;
  }

  const onlyMemberMentions = mentionedNames.every(
    (name) => name.toUpperCase() === "ALL" || members.some((member) => member.name === name)
  );

  if (onlyMemberMentions) {
    return false;
  }

  return true;
}

function getStatusLabel(message: Pick<ChatMessage, "senderType" | "status">) {
  if (message.status === "FAILED") {
    return "FAILED";
  }

  if (message.senderType === "AGENT" && message.status === "STREAMING") {
    return "STREAMING";
  }

  if (message.senderType === "USER" && message.status === "PENDING") {
    return "Sending";
  }

  return null;
}

function isPersistedDuplicate(serverMessage: ChatMessage, localMessage: LocalChatMessage) {
  if (serverMessage.id === localMessage.id || serverMessage.id === localMessage.persistedId) {
    return true;
  }

  if (
    localMessage.optimistic &&
    localMessage.senderType === "USER" &&
    localMessage.status !== "FAILED" &&
    serverMessage.senderType === "USER" &&
    serverMessage.channelId === localMessage.channelId &&
    serverMessage.content === localMessage.content &&
    Math.abs(new Date(serverMessage.createdAt).getTime() - new Date(localMessage.createdAt).getTime()) <
      RETRY_DUPLICATE_WINDOW_MS
  ) {
    // ponytail: fallback to a short time-window match when POST 201 returns no message payload.
    return true;
  }

  return false;
}

function createLocalMessage(partial: Omit<LocalChatMessage, "id"> & { idPrefix: "local-user" | "local-agent" }) {
  const id = `${partial.idPrefix}-${crypto.randomUUID()}`;
  const { idPrefix, ...message } = partial;
  void idPrefix;
  return {
    ...message,
    id
  } satisfies LocalChatMessage;
}

function renderMessageContent(content: string, agents: AgentSummary[]) {
  const pattern = /(@All|@AI|@[^\s@]+)/g;

  return content.split(pattern).map((part, index) => {
    if (part === "@All") {
      return (
        <Tag
          key={`mention-all-${index}`}
          color="purple"
          style={{ marginInline: 0, paddingInline: 8, borderRadius: 999 }}
        >
          @All
        </Tag>
      );
    }

    if (part === "@AI") {
      return (
        <Tag
          key={`mention-ai-${index}`}
          color="purple"
          style={{ marginInline: 0, paddingInline: 8, borderRadius: 999 }}
        >
          @AI
        </Tag>
      );
    }

    if (part.startsWith("@") && part.length > 1) {
      const name = part.slice(1);
      const matchedAgent = agents.find((agent) => agent.name === name);

      if (matchedAgent) {
        return (
          <ExpertMentionTag key={`mention-agent-${index}`} agent={matchedAgent} />
        );
      }
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function ExpertMentionTag({ agent }: { agent: AgentSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={<AgentInfoPanel agent={agent} />}
    >
      <Tag
        color="geekblue"
        style={{ marginInline: 0, paddingInline: 8, borderRadius: 999, cursor: "pointer" }}
      >
        {agent.emoji ? `${agent.emoji} ` : ""}@{agent.name}
      </Tag>
    </Popover>
  );
}

function AgentInfoPanel({ agent }: { agent: AgentSummary }) {
  return (
    <div style={{ maxWidth: 240 }}>
      <Typography.Text strong>
        {agent.emoji ? `${agent.emoji} ` : ""}
        {agent.name}
      </Typography.Text>
      {agent.role ? (
        <div>
          <Typography.Text type="secondary">{agent.role}</Typography.Text>
        </div>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <Typography.Text type="secondary">What I can do:</Typography.Text>
        <div>{agent.description || "No description yet"}</div>
      </div>
    </div>
  );
}

export function WorkspaceShell() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { workspaceId, selectedWorkspace, selectedChannel, selectedChannelId, members, agents } = useWorkspaceContext();
  const accessToken = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [draftState, setDraftState] = useState<{ channelId: string | null; value: string }>({
    channelId: null,
    value: ""
  });
  const [isSending, setIsSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const { localMessages, setLocalMessages, removeLocalMessage, patchLocalMessage } = useChatStream();
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatusState | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<ComponentRef<typeof Sender> | null>(null);
  const suggestionOpenRef = useRef(false);
  const scrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const autoScrolledChannelRef = useRef<string | null>(null);
  const activeStreamAbortRef = useRef<AbortController | null>(null);
  const shouldAutoFollowRef = useRef(true);
  const copiedTooltipTimeoutRef = useRef<number | null>(null);
  const channelNameRef = useRef<string | null>(null);
  useEffect(() => {
    channelNameRef.current = selectedChannel?.name ?? null;
  }, [selectedChannel?.name]);
  const draft = draftState.channelId === selectedChannelId ? draftState.value : "";

  const messagesQuery = useInfiniteQuery({
    queryKey: chatKeys.messages(selectedChannelId),
    queryFn: ({ pageParam }) => fetchChannelMessages(selectedChannelId as string, pageParam),
    initialPageParam: null as string | null,
    enabled: !!selectedChannelId,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const persistedMessages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();

    for (const page of messagesQuery.data?.pages ?? []) {
      for (const item of page.items) {
        byId.set(item.id, item);
      }
    }

    return Array.from(byId.values()).sort(compareMessages);
  }, [messagesQuery.data]);

  const channelMessages = useMemo<LocalChatMessage[]>(() => {
    if (!selectedChannelId) {
      return [];
    }

    const visibleLocalMessages = localMessages
      .filter((item) => item.channelId === selectedChannelId)
      .filter((item) => !persistedMessages.some((persisted) => isPersistedDuplicate(persisted, item)));

    return [...persistedMessages, ...visibleLocalMessages].sort(compareMessages);
  }, [localMessages, persistedMessages, selectedChannelId]);

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight });
      }
    });
  }, []);

  const scrollToBottomIfNeeded = useCallback((force = false) => {
    if (!messagesContainerRef.current || (!force && !shouldAutoFollowRef.current)) {
      return;
    }

    scrollToBottom();
  }, [scrollToBottom]);

  const patchPersistedMessage = useCallback(
    (
      channelId: string,
      messageId: string,
      updater: (message: ChatMessage) => ChatMessage
    ) => {
      queryClient.setQueryData<{
        pages: ChannelMessagesResponse[];
        pageParams: Array<string | null>;
      }>(chatKeys.messages(channelId), (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === messageId ? updater(item) : item))
          }))
        };
      });
    },
    [queryClient]
  );

  const refetchCurrentMessages = useCallback(async () => {
    if (!selectedChannelId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: chatKeys.messages(selectedChannelId) });
    await messagesQuery.refetch();
  }, [messagesQuery, queryClient, selectedChannelId]);

  const feedbackMutation = useMutation({
    mutationFn: ({ channelId, messageId, requestedType }: FeedbackMutationVariables) =>
      apiFetch(`/channels/${channelId}/messages/${messageId}/feedback`, {
        method: "PATCH",
        body: { type: requestedType }
      }),
    onMutate: ({ channelId, messageId, nextFeedback, previousFeedback }) => {
      patchPersistedMessage(channelId, messageId, (current) => ({
        ...current,
        feedback: nextFeedback
      }));

      return { previousFeedback };
    },
    onError: (error, variables, context) => {
      patchPersistedMessage(variables.channelId, variables.messageId, (current) => ({
        ...current,
        feedback: context?.previousFeedback ?? variables.previousFeedback
      }));
      message.error(error instanceof ApiError ? error.message : "Failed to submit feedback");
    }
  });

  const streamAgentReply = useCallback(
    async (channelId: string, content: string, localAgentMessageId: string) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const abortController = new AbortController();
      activeStreamAbortRef.current?.abort();
      activeStreamAbortRef.current = abortController;
      let streamCompleted = false;
      let streamErrorMessage: string | null = null;
      setStreamStatus({ channelId, agentName: "AI Agent", modelName: null });

      try {
        await streamSse({
          url: resolveApiUrl(`/channels/${channelId}/ai/stream`),
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: { content },
          signal: abortController.signal,
          onEvent: async ({ event, data }) => {
            if (event !== "message") {
              return;
            }

            const payload = JSON.parse(data) as StreamEventPayload;
            const reasoningContent = pickFirstString(payload.reasoning, payload.reasoning_content, payload.thinking);
            const agentName = pickFirstString(payload.agentName, payload.agent) ?? "AI Agent";
            const modelName = pickFirstString(payload.model);

            setStreamStatus((current) => {
              const next = {
                channelId,
                agentName,
                modelName
              } satisfies StreamStatusState;

              if (
                current?.channelId === next.channelId &&
                current.agentName === next.agentName &&
                current.modelName === next.modelName
              ) {
                return current;
              }

              return next;
            });

            if (reasoningContent) {
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                agentName,
                modelName: modelName ?? current.modelName,
                thinkingContent: appendStreamText(current.thinkingContent, reasoningContent),
                status: "STREAMING"
              }));
              scrollToBottomIfNeeded();
            }

            if (payload.type === "citations" && payload.citations) {
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                citations: payload.citations
              }));
              return;
            }

            if (payload.type === "token" && payload.content) {
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                agentName,
                modelName: modelName ?? current.modelName,
                content: `${current.content}${payload.content}`,
                status: "STREAMING"
              }));
              scrollToBottomIfNeeded();
              return;
            }

            if (payload.type === "done") {
              streamCompleted = true;
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                agentName,
                modelName: modelName ?? current.modelName,
                harness: payload.harness ?? current.harness,
                persistedId: payload.messageId ?? current.persistedId,
                status: "COMPLETED"
              }));
              return;
            }

            if (payload.type === "error") {
              streamErrorMessage = payload.message ?? "AI response failed";
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                errorMessage: streamErrorMessage ?? "AI response failed",
                status: "FAILED"
              }));
              throw new Error(streamErrorMessage);
            }
          }
        });

        if (streamCompleted) {
          await refetchCurrentMessages();
          // After the AI response completes, generate a title if the channel still has its default name (DeepSeek-style)
          const channelName = channelNameRef.current;
          if (channelName && /^(Chat\s*\d+|New Chat|\u5bf9\u8bdd\s*\d+|\u65b0\u5bf9\u8bdd)$/.test(channelName)) {
            try {
              await apiFetch<{ title: string }>(`/channels/${channelId}/generate-title`, {
                method: "POST"
              });
              queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) });
            } catch {
              // Title generation failure does not affect the main flow
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          removeLocalMessage(localAgentMessageId);
          return;
        }

        if (!streamErrorMessage) {
          const fallbackMessage = error instanceof Error ? error.message : "AI response failed";
          patchLocalMessage(localAgentMessageId, (current) => ({
            ...current,
            errorMessage: fallbackMessage,
            status: "FAILED"
          }));
        }

        throw error;
      } finally {
        if (activeStreamAbortRef.current === abortController) {
          activeStreamAbortRef.current = null;
        }
        setStreamStatus((current) => (current?.channelId === channelId ? null : current));
      }
    },
    [accessToken, patchLocalMessage, queryClient, refetchCurrentMessages, removeLocalMessage, scrollToBottomIfNeeded, workspaceId]
  );

  const sendMessage = useCallback(
    async (rawContent: string, options?: { streamOnly?: boolean; retryMessageId?: string }) => {
      if (!selectedChannelId || !user) {
        return;
      }

      const content = rawContent.trim();

      if (!content || isSending) {
        return;
      }

      setIsSending(true);

      const shouldTriggerAi = resolveShouldTriggerAi(content, agents, members);
      const createdAt = new Date().toISOString();
      const localUserMessageId = options?.streamOnly
        ? null
        : options?.retryMessageId ??
          createLocalMessage({
            idPrefix: "local-user",
            channelId: selectedChannelId,
            senderType: "USER",
            senderId: user.id,
            content,
            status: "PENDING",
            createdAt,
            optimistic: true,
            requestContent: content
          }).id;

      if (options?.retryMessageId) {
        patchLocalMessage(options.retryMessageId, (current) => ({
          ...current,
          content,
          errorMessage: undefined,
          status: current.senderType === "USER" ? "PENDING" : "STREAMING"
        }));
      } else if (localUserMessageId) {
        setLocalMessages((current) => [
          ...current,
          {
            id: localUserMessageId,
            channelId: selectedChannelId,
            senderType: "USER",
            senderId: user.id,
            content,
            status: "PENDING",
            createdAt,
            optimistic: true,
            requestContent: content
          }
        ]);
      }

      if (!options?.retryMessageId) {
        setDraftState({
          channelId: selectedChannelId,
          value: ""
        });
      }

      scrollToBottomIfNeeded(true);

      try {
        if (!options?.streamOnly) {
          const savedMessage = await apiFetch<ChatMessage | undefined>(`/channels/${selectedChannelId}/messages`, {
            method: "POST",
            body: { content }
          });

          if (localUserMessageId) {
            patchLocalMessage(localUserMessageId, (current) => ({
              ...current,
              persistedId: isChatMessage(savedMessage) ? savedMessage.id : current.persistedId,
              status: "COMPLETED"
            }));
          }
        }

        if (shouldTriggerAi) {
          const localAgentMessage = createLocalMessage({
            idPrefix: "local-agent",
            channelId: selectedChannelId,
            senderType: "AGENT",
            senderId: "default-agent",
            content: "",
            status: "STREAMING",
            createdAt: new Date().toISOString(),
            requestContent: content,
            feedback: null,
            thinkingContent: "",
            agentName: "AI Agent",
            modelName: null
          });

          setLocalMessages((current) => {
            const next = options?.streamOnly && options.retryMessageId
              ? current.filter((item) => item.id !== options.retryMessageId)
              : current;
            return [...next, localAgentMessage];
          });
          scrollToBottomIfNeeded(true);
          await streamAgentReply(selectedChannelId, content, localAgentMessage.id);
        } else {
          await refetchCurrentMessages();
        }
      } catch (error) {
        const errorMessage =
          error instanceof ApiError || error instanceof Error ? error.message : "Send failed. Please try again later.";

        if (options?.retryMessageId) {
          patchLocalMessage(options.retryMessageId, (current) => ({
            ...current,
            errorMessage,
            status: "FAILED"
          }));
        } else if (localUserMessageId) {
          patchLocalMessage(localUserMessageId, (current) => ({
            ...current,
            errorMessage,
            status: "FAILED"
          }));
        }

        message.error(errorMessage);
      } finally {
        setIsSending(false);
        requestAnimationFrame(() => {
          composerRef.current?.focus();
        });
      }
    },
    [
      agents,
      isSending,
      members,
      message,
      patchLocalMessage,
      refetchCurrentMessages,
      scrollToBottomIfNeeded,
      selectedChannelId,
      setLocalMessages,
      streamAgentReply,
      user
    ]
  );

  const retryMessage = useCallback(
    async (targetMessage: LocalChatMessage) => {
      if (targetMessage.senderType === "AGENT" && targetMessage.requestContent) {
        await sendMessage(targetMessage.requestContent, {
          retryMessageId: targetMessage.id,
          streamOnly: true
        });
        return;
      }

      if (targetMessage.senderType === "USER" && targetMessage.requestContent) {
        await sendMessage(targetMessage.requestContent, {
          retryMessageId: targetMessage.id
        });
      }
    },
    [sendMessage]
  );

  useEffect(() => {
    autoScrolledChannelRef.current = null;
    activeStreamAbortRef.current?.abort();
    shouldAutoFollowRef.current = true;
  }, [selectedChannelId]);

  useEffect(
    () => () => {
      activeStreamAbortRef.current?.abort();
      if (copiedTooltipTimeoutRef.current) {
        window.clearTimeout(copiedTooltipTimeoutRef.current);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (!messagesContainerRef.current || messagesQuery.isFetchingNextPage || !scrollRestoreRef.current) {
      return;
    }

    const { scrollHeight, scrollTop } = scrollRestoreRef.current;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - scrollHeight + scrollTop;
    scrollRestoreRef.current = null;
  }, [channelMessages.length, messagesQuery.isFetchingNextPage]);

  useLayoutEffect(() => {
    if (
      !selectedChannelId ||
      !messagesContainerRef.current ||
      autoScrolledChannelRef.current === selectedChannelId ||
      messagesQuery.isLoading
    ) {
      return;
    }

    autoScrolledChannelRef.current = selectedChannelId;
    scrollToBottomIfNeeded(true);
  }, [channelMessages.length, messagesQuery.isLoading, scrollToBottomIfNeeded, selectedChannelId]);

  const handleMessagesScroll = useCallback(() => {
    if (!messagesContainerRef.current) {
      return;
    }

    shouldAutoFollowRef.current = isNearBottom(messagesContainerRef.current);

    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage || messagesContainerRef.current.scrollTop > 48) {
      return;
    }

    scrollRestoreRef.current = {
      scrollHeight: messagesContainerRef.current.scrollHeight,
      scrollTop: messagesContainerRef.current.scrollTop
    };
    void messagesQuery.fetchNextPage();
  }, [messagesQuery]);

  const handleSubmit = useCallback(() => {
    void sendMessage(draft);
  }, [draft, sendMessage]);

  const mentionItems = useMemo(
    () => [
      { label: "All members", value: "@All", icon: <TeamOutlined /> },
      { label: "AI Agent", value: "@AI", icon: <RobotOutlined /> },
      ...agents.map((agent) => ({
        label: `${agent.emoji ? `${agent.emoji} ` : ""}${agent.name}`,
        value: `@${agent.name}`,
        icon: <RobotOutlined />
      })),
      ...members.map((member) => ({
        label: member.name,
        value: `@${member.name}`,
        icon: <UserOutlined />
      }))
    ],
    [agents, members]
  );

  const handleMentionSelect = useCallback((value: string) => {
    setDraftState((current) => {
      const currentValue = current.channelId === selectedChannelId ? current.value : "";
      const atIndex = currentValue.lastIndexOf("@");
      const nextValue =
        atIndex === -1 ? `${currentValue}${value} ` : `${currentValue.slice(0, atIndex)}${value} `;

      return {
        channelId: selectedChannelId,
        value: nextValue
      };
    });
  }, [selectedChannelId]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      const textarea = composerRef.current?.inputElement as HTMLTextAreaElement | null;
      const position = textarea?.selectionStart ?? draft.length;
      const next = `${draft.slice(0, position)}${emoji}${draft.slice(position)}`;
      setDraftState({
        channelId: selectedChannelId,
        value: next
      });
      setEmojiOpen(false);
      requestAnimationFrame(() => {
        textarea?.focus();
        const cursor = position + emoji.length;
        textarea?.setSelectionRange(cursor, cursor);
      });
    },
    [draft, selectedChannelId]
  );

  const handleCopyMessage = useCallback(
    async (messageId: string, content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        if (copiedTooltipTimeoutRef.current) {
          window.clearTimeout(copiedTooltipTimeoutRef.current);
        }
        setCopiedMessageId(messageId);
        copiedTooltipTimeoutRef.current = window.setTimeout(() => {
          setCopiedMessageId((current) => (current === messageId ? null : current));
          copiedTooltipTimeoutRef.current = null;
        }, 1200);
      } catch (error) {
        message.error(error instanceof Error ? error.message : "Failed to copy");
      }
    },
    [message]
  );

  const handleFeedback = useCallback(
    (chatMessage: LocalChatMessage, requestedType: Exclude<MessageFeedback, null>) => {
      if (!selectedChannelId) {
        return;
      }

      const messageId = chatMessage.persistedId ?? (chatMessage.id.startsWith("local-") ? null : chatMessage.id);

      if (!messageId) {
        return;
      }

      const previousFeedback = chatMessage.feedback ?? null;
      const nextFeedback = previousFeedback === requestedType ? null : requestedType;

      feedbackMutation.mutate({
        channelId: selectedChannelId,
        messageId,
        requestedType,
        nextFeedback,
        previousFeedback
      });
    },
    [feedbackMutation, selectedChannelId]
  );

  const regenerateMessage = useCallback(
    async (targetMessage: LocalChatMessage) => {
      const targetIndex = channelMessages.findIndex((item) => item.id === targetMessage.id);

      if (targetIndex <= 0) {
        message.error("Could not find the previous user message to regenerate");
        return;
      }

      const sourceMessage = channelMessages
        .slice(0, targetIndex)
        .reverse()
        .find((item) => item.senderType === "USER" && item.content.trim());

      if (!sourceMessage) {
        message.error("Could not find the previous user message to regenerate");
        return;
      }

      await sendMessage(sourceMessage.content, { streamOnly: true });
    },
    [channelMessages, message, sendMessage]
  );

  if (!user) {
    return <FullScreenSpinner />;
  }

  return (
    <div className={styles.main}>
      <div className={styles.center}>
        <header className={styles.topbar}>
          <div className={styles.workspaceMeta}>
            <Typography.Title level={4} className={styles.topbarTitle}>
              {selectedWorkspace?.name ?? "Create your first workspace"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {selectedWorkspace
                ? "Team collaboration and AI context accumulate in one workspace."
                : "A #general channel is created automatically after you create a workspace."}
            </Typography.Text>
          </div>

          <div className={styles.memberBar}>
            {screens.md ? (
              <Avatar.Group max={{ count: 4 }}>
                {members.map((member) => (
                  <Tooltip key={member.id} title={`${member.name} · ${member.role}`}>
                    <Avatar>{member.name.slice(0, 1).toUpperCase()}</Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            ) : null}
          </div>
        </header>

        <main className={styles.conversation}>
          {selectedWorkspace ? (
            <>
              <div className={styles.channelCard}>
                <div className={styles.channelBody}>
                  <Typography.Title level={3} className={styles.channelTitle}>
                    {selectedChannel ? `# ${selectedChannel.name}` : "Select a channel"}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {selectedChannel
                      ? "Messages support history loading, optimistic sending, and streaming @AI responses."
                      : "The current workspace has no available channels."}
                  </Typography.Text>
                </div>
              </div>

              <MessageList>
              <div className={styles.messagesPanel}>
                <div ref={messagesContainerRef} className={styles.messageScrollArea} onScroll={handleMessagesScroll}>
                  {selectedChannel ? (
                    <>
                      {messagesQuery.hasNextPage ? (
                        <div className={styles.historyHint}>
                          {messagesQuery.isFetchingNextPage ? (
                            <>
                              <LoadingOutlined spin />
                              Loading earlier messages...
                            </>
                          ) : (
                            "Scroll up to load earlier messages"
                          )}
                        </div>
                      ) : channelMessages.length ? (
                        <div className={styles.historyHint}>All messages displayed</div>
                      ) : null}

                      {messagesQuery.isLoading ? (
                        <div className={styles.messageLoading}>
                          <LoadingState compact title="Syncing messages" description="Chat history will be ready shortly." />
                        </div>
                      ) : channelMessages.length ? (
                        <div className={styles.messageList}>
                          {channelMessages.map((chatMessage) => {
                            const statusLabel = getStatusLabel(chatMessage);
                            const isUserMessage = chatMessage.senderType === "USER";
                            const isFailed = chatMessage.status === "FAILED";
                            const effectiveMessageId =
                              chatMessage.persistedId ?? (chatMessage.id.startsWith("local-") ? null : chatMessage.id);
                            const hasThinking = !!chatMessage.thinkingContent?.trim();
                            const feedback = chatMessage.feedback ?? null;

                            return (
                              <div
                                key={chatMessage.id}
                                className={`${styles.messageRow} ${
                                  isUserMessage ? styles.messageRowUser : styles.messageRowAgent
                                }`}
                              >
                                <div
                                  className={`${styles.messageBubble} ${
                                    isUserMessage ? styles.messageBubbleUser : styles.messageBubbleAgent
                                  } ${isFailed ? styles.messageBubbleFailed : ""}`}
                                >
                                  <div className={styles.messageMeta}>
                                    <span className={styles.messageAuthor}>
                                      {isUserMessage ? user.name || "You" : chatMessage.agentName || "AI Agent"}
                                    </span>
                                    {!isUserMessage && chatMessage.harness ? (
                                      <Tag color="blue" style={{ marginLeft: 8, fontSize: 11, lineHeight: "18px" }}>
                                        {chatMessage.harness}
                                      </Tag>
                                    ) : null}
                                    <span className={styles.messageTimestamp}>{formatMessageTime(chatMessage.createdAt)}</span>
                                    {statusLabel ? <span className={styles.messageStatus}>{statusLabel}</span> : null}
                                  </div>

                                  {chatMessage.senderType === "AGENT" ? (
                                    <>
                                      {hasThinking ? (
                                        <details className={styles.thinkingBlock} open={chatMessage.status === "STREAMING"}>
                                          <summary className={styles.thinkingSummary}>Thinking process</summary>
                                          <div className={styles.thinkingContent}>{chatMessage.thinkingContent}</div>
                                        </details>
                                      ) : chatMessage.status === "STREAMING" ? (
                                        <div className={styles.thinkingIndicator}>
                                          <Bubble
                                            content="Thinking…"
                                            loading
                                            variant="outlined"
                                            rootClassName={styles.thinkingBubble}
                                          />
                                        </div>
                                      ) : null}

                                      <div className={styles.markdown}>
                                        <ReactMarkdown>{chatMessage.content || " "}</ReactMarkdown>
                                        {chatMessage.status === "STREAMING" ? (
                                          <span className={styles.streamCursor} aria-hidden="true" />
                                        ) : null}
                                      </div>
                                    </>
                                  ) : (
                                    <div className={styles.messageText}>{renderMessageContent(chatMessage.content, agents)}</div>
                                  )}

                                  {isFailed ? (
                                    <div className={styles.messageErrorRow}>
                                      <span>{chatMessage.errorMessage ?? "Request failed. Please try again later."}</span>
                                      {chatMessage.requestContent ? (
                                        <Button
                                          size="small"
                                          type="link"
                                          className={styles.retryButton}
                                          disabled={isSending}
                                          onClick={() => void retryMessage(chatMessage)}
                                        >
                                          Retry
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className={styles.messageActions}>
                                    {isUserMessage ? null : (
                                      <>
                                        <Tooltip title={feedback === "like" ? "Remove like" : "Like"}>
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label={feedback === "like" ? "Remove like" : "Like this response"}
                                            className={`${styles.messageActionButton} ${
                                              feedback === "like" ? styles.messageActionButtonActive : ""
                                            }`}
                                            disabled={!effectiveMessageId || feedbackMutation.isPending}
                                            icon={<LikeOutlined />}
                                            onClick={() => handleFeedback(chatMessage, "like")}
                                          />
                                        </Tooltip>
                                        <Tooltip title={feedback === "dislike" ? "Remove dislike" : "Dislike"}>
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label={feedback === "dislike" ? "Remove dislike" : "Dislike this response"}
                                            className={`${styles.messageActionButton} ${
                                              feedback === "dislike" ? styles.messageActionButtonActive : ""
                                            }`}
                                            disabled={!effectiveMessageId || feedbackMutation.isPending}
                                            icon={<DislikeOutlined />}
                                            onClick={() => handleFeedback(chatMessage, "dislike")}
                                          />
                                        </Tooltip>
                                        <Tooltip title="Regenerate">
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label="Regenerate response"
                                            className={styles.messageActionButton}
                                            disabled={isSending}
                                            icon={<RedoOutlined />}
                                            onClick={() => void regenerateMessage(chatMessage)}
                                          />
                                        </Tooltip>
                                      </>
                                    )}
                                    <Tooltip title="Copied" open={copiedMessageId === chatMessage.id ? true : undefined}>
                                      <Button
                                        type="text"
                                        size="small"
                                        aria-label="Copy message"
                                        className={styles.messageActionButton}
                                        icon={<CopyOutlined />}
                                        onClick={() => void handleCopyMessage(chatMessage.id, chatMessage.content)}
                                      />
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={styles.emptyState}>
                          <EmptyState
                            icon={<RobotOutlined />}
                            title="Start a new conversation"
                            description={
                              <>
                                Send a message to start collaborating, or enter <strong>@AI</strong> to trigger a streaming response.
                              </>
                            }
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.emptyState}>
                      <EmptyState
                        icon={<MessageOutlined />}
                        title="No channels available yet"
                        description="Create a channel to accumulate team messages and AI conversations here."
                        action={
                          <Button icon={<PlusOutlined />} onClick={() => window.dispatchEvent(new CustomEvent("wade-ai:create-channel"))}>
                            Create chat
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
              </MessageList>

              <Composer>
              <div className={styles.composer}>
                {streamStatus?.channelId === selectedChannelId ? (
                  <div className={styles.composerStatus}>
                    <Bubble
                      content={`${streamStatus.agentName}${streamStatus.modelName ? ` · ${streamStatus.modelName}` : ""} Thinking…`}
                      loading
                      variant="outlined"
                    />
                  </div>
                ) : null}
                <div className={styles.composerInput}>
                  <Suggestion
                    items={(info?: { query?: string }) => {
                      const query = info?.query?.toLowerCase() ?? "";
                      return query
                        ? mentionItems.filter((item) => item.value.toLowerCase().includes(query))
                        : mentionItems;
                    }}
                    onSelect={(value: string) => handleMentionSelect(value)}
                  >
                    {({ onTrigger, onKeyDown, open }) => {
                      suggestionOpenRef.current = open;
                      return (
                        <Sender
                          ref={composerRef}
                          aria-label="Channel message"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          loading={isSending}
                          value={draft}
                          disabled={!selectedChannel || isSending}
                          placeholder={
                            selectedChannel
                              ? "Send messages and chat with AI; @mention an expert to select one"
                              : "Select a channel first"
                          }
                          onChange={(value) => {
                            setDraftState({
                              channelId: selectedChannelId,
                              value
                            });
                            const match = value.match(/@([^\s@]*)$/);
                            if (match) {
                              onTrigger({ query: match[1] });
                            } else {
                              onTrigger(false);
                            }
                          }}
                          onSubmit={() => {
                            if (suggestionOpenRef.current) {
                              return;
                            }
                            handleSubmit();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === " " && suggestionOpenRef.current) {
                              // The Suggestion Cascader popup consumes the space key → close it manually and insert a space
                              suggestionOpenRef.current = false;
                              onTrigger(false);
                              const textarea = composerRef.current?.inputElement as HTMLTextAreaElement | null;
                              const currentValue = textarea?.value ?? draft;
                              const position = textarea?.selectionStart ?? currentValue.length;
                              const next = `${currentValue.slice(0, position)} ${currentValue.slice(position)}`;
                              setDraftState({
                                channelId: selectedChannelId,
                                value: next
                              });
                              event.preventDefault();
                              requestAnimationFrame(() => {
                                textarea?.focus();
                                const cursor = position + 1;
                                textarea?.setSelectionRange(cursor, cursor);
                              });
                              return;
                            }
                            onKeyDown?.(event);
                          }}
                          suffix={(defaultActions) => (
                            <>
                              {defaultActions}
                              <Popover
                                open={emojiOpen}
                                onOpenChange={setEmojiOpen}
                                trigger="click"
                                placement="topRight"
                                content={
                                  <div className={styles.emojiGrid}>
                                    {EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className={styles.emojiItem}
                                        onClick={() => insertEmoji(emoji)}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                }
                              >
                                <Button
                                  type="text"
                                  aria-label="Insert emoji"
                                  icon={<SmileOutlined />}
                                  onClick={() => setEmojiOpen((prev) => !prev)}
                                />
                              </Popover>
                            </>
                          )}
                        />
                      );
                    }}
                  </Suggestion>
                  <Typography.Text type="secondary" className={styles.composerHint}>
                    Enter <strong>@Expert</strong> to select an expert; without @, AI replies by default; <strong>@Member</strong> only mentions a member and does not trigger AI; Shift + Enter adds a line break.
                  </Typography.Text>
                </div>
              </div>
              </Composer>
            </>
          ) : (
            <EmptyState
              className={styles.workspaceEmpty}
              align="left"
              icon={<TeamOutlined />}
              title="No workspace yet"
              description="Creating one automatically adds you as OWNER and creates the default #general channel."
              action={
                <Button type="primary" onClick={() => router.push("/")}>
                  Create a workspace
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
