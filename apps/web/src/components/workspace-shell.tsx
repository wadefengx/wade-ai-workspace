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
import { useWorkspaceContext, workspaceKeys } from "./workspace-context";
import { ApiError, apiFetch, resolveApiUrl } from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { streamSse } from "../lib/sse";
import { useAuthStore } from "../stores/auth";
import styles from "./workspace-shell.module.css";
import { EmptyState, LoadingState } from "./ui-state";

type MessageSenderType = "USER" | "AGENT";
type MessageStatus = "PENDING" | "STREAMING" | "COMPLETED" | "FAILED";
type MessageFeedback = "like" | "dislike" | null;

type ChatMessage = {
  id: string;
  channelId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  status: MessageStatus;
  createdAt: string;
  feedback?: MessageFeedback;
};

type LocalChatMessage = ChatMessage & {
  errorMessage?: string;
  optimistic?: boolean;
  persistedId?: string;
  requestContent?: string;
  thinkingContent?: string;
  agentName?: string | null;
  modelName?: string | null;
};

type ChannelMessagesResponse = {
  items: ChatMessage[];
  nextCursor: string | null;
};

type StreamEventPayload = {
  type: "token" | "done" | "error" | "reasoning" | "thinking" | string;
  content?: string;
  messageId?: string;
  message?: string;
  reasoning?: string;
  reasoning_content?: string;
  thinking?: string;
  agent?: string;
  agentName?: string;
  model?: string;
};

type StreamStatusState = {
  channelId: string;
  agentName: string;
  modelName: string | null;
};

type FeedbackMutationVariables = {
  channelId: string;
  messageId: string;
  requestedType: Exclude<MessageFeedback, null>;
  nextFeedback: MessageFeedback;
  previousFeedback: MessageFeedback;
};

const PAGE_SIZE = 20;
const RETRY_DUPLICATE_WINDOW_MS = 60_000;

// 常用表情(轻量内置面板,不引入 emoji 库)
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

function getStatusLabel(message: Pick<ChatMessage, "senderType" | "status">) {
  if (message.status === "FAILED") {
    return "FAILED";
  }

  if (message.senderType === "AGENT" && message.status === "STREAMING") {
    return "STREAMING";
  }

  if (message.senderType === "USER" && message.status === "PENDING") {
    return "发送中";
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

function renderMessageContent(content: string) {
  return content.split(/(@All)/g).map((part, index) => {
    if (part !== "@All") {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <Tag
        key={`mention-${index}`}
        color="purple"
        style={{ marginInline: 0, paddingInline: 8, borderRadius: 999 }}
      >
        @All
      </Tag>
    );
  });
}

export function WorkspaceShell() {
  const router = useRouter();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { workspaceId, selectedWorkspace, selectedChannel, selectedChannelId, members } = useWorkspaceContext();
  const accessToken = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [draftState, setDraftState] = useState<{ channelId: string | null; value: string }>({
    channelId: null,
    value: ""
  });
  const [isSending, setIsSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
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

  const removeLocalMessage = useCallback((messageId: string) => {
    setLocalMessages((current) => current.filter((item) => item.id !== messageId));
  }, []);

  const patchLocalMessage = useCallback((messageId: string, updater: (message: LocalChatMessage) => LocalChatMessage) => {
    setLocalMessages((current) => current.map((item) => (item.id === messageId ? updater(item) : item)));
  }, []);

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
      message.error(error instanceof ApiError ? error.message : "反馈提交失败");
    }
  });

  const streamAgentReply = useCallback(
    async (channelId: string, content: string, localAgentMessageId: string) => {
      if (!accessToken) {
        throw new Error("登录状态已失效，请重新登录");
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
                persistedId: payload.messageId ?? current.persistedId,
                status: "COMPLETED"
              }));
              return;
            }

            if (payload.type === "error") {
              streamErrorMessage = payload.message ?? "AI 回复失败";
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                errorMessage: streamErrorMessage ?? "AI 回复失败",
                status: "FAILED"
              }));
              throw new Error(streamErrorMessage);
            }
          }
        });

        if (streamCompleted) {
          await refetchCurrentMessages();
          // AI 回复完成后,若频道还是默认名,调用模型生成标题(DeepSeek 式)
          const channelName = channelNameRef.current;
          if (channelName && /^(对话\s*\d+|新对话)$/.test(channelName)) {
            try {
              await apiFetch<{ title: string }>(`/channels/${channelId}/generate-title`, {
                method: "POST"
              });
              queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) });
            } catch {
              // 标题生成失败不影响主流程
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          removeLocalMessage(localAgentMessageId);
          return;
        }

        if (!streamErrorMessage) {
          const fallbackMessage = error instanceof Error ? error.message : "AI 回复失败";
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

      const shouldTriggerAi = content.includes("@AI");
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
          error instanceof ApiError || error instanceof Error ? error.message : "发送失败，请稍后重试";

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
      isSending,
      message,
      patchLocalMessage,
      refetchCurrentMessages,
      scrollToBottomIfNeeded,
      selectedChannelId,
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
      ...members.map((member) => ({
        label: member.name,
        value: `@${member.name}`,
        icon: <UserOutlined />
      }))
    ],
    [members]
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
        message.error(error instanceof Error ? error.message : "复制失败");
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
        message.error("未找到可重新生成的上一条用户消息");
        return;
      }

      const sourceMessage = channelMessages
        .slice(0, targetIndex)
        .reverse()
        .find((item) => item.senderType === "USER" && item.content.trim());

      if (!sourceMessage) {
        message.error("未找到可重新生成的上一条用户消息");
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
              {selectedWorkspace?.name ?? "创建你的第一个 Workspace"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {selectedWorkspace
                ? "团队协作与 AI 上下文在同一个工作区中沉淀。"
                : "创建 Workspace 后会自动生成 #general 频道。"}
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
                    {selectedChannel ? `# ${selectedChannel.name}` : "选择一个频道"}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {selectedChannel
                      ? "消息支持历史加载、乐观发送与 @AI 流式回答。"
                      : "当前 Workspace 还没有可用频道。"}
                  </Typography.Text>
                </div>
              </div>

              <div className={styles.messagesPanel}>
                <div ref={messagesContainerRef} className={styles.messageScrollArea} onScroll={handleMessagesScroll}>
                  {selectedChannel ? (
                    <>
                      {messagesQuery.hasNextPage ? (
                        <div className={styles.historyHint}>
                          {messagesQuery.isFetchingNextPage ? (
                            <>
                              <LoadingOutlined spin />
                              正在加载更早消息...
                            </>
                          ) : (
                            "向上滚动加载更早消息"
                          )}
                        </div>
                      ) : channelMessages.length ? (
                        <div className={styles.historyHint}>已显示全部消息</div>
                      ) : null}

                      {messagesQuery.isLoading ? (
                        <div className={styles.messageLoading}>
                          <LoadingState compact title="正在同步消息" description="聊天记录马上就好。" />
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
                                    <span className={styles.messageTimestamp}>{formatMessageTime(chatMessage.createdAt)}</span>
                                    {statusLabel ? <span className={styles.messageStatus}>{statusLabel}</span> : null}
                                  </div>

                                  {chatMessage.senderType === "AGENT" ? (
                                    <>
                                      {hasThinking ? (
                                        <details className={styles.thinkingBlock} open={chatMessage.status === "STREAMING"}>
                                          <summary className={styles.thinkingSummary}>思考过程</summary>
                                          <div className={styles.thinkingContent}>{chatMessage.thinkingContent}</div>
                                        </details>
                                      ) : chatMessage.status === "STREAMING" ? (
                                        <div className={styles.thinkingIndicator}>
                                          <Bubble
                                            content="正在思考…"
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
                                    <div className={styles.messageText}>{renderMessageContent(chatMessage.content)}</div>
                                  )}

                                  {isFailed ? (
                                    <div className={styles.messageErrorRow}>
                                      <span>{chatMessage.errorMessage ?? "请求失败，请稍后重试"}</span>
                                      {chatMessage.requestContent ? (
                                        <Button
                                          size="small"
                                          type="link"
                                          className={styles.retryButton}
                                          disabled={isSending}
                                          onClick={() => void retryMessage(chatMessage)}
                                        >
                                          重试
                                        </Button>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className={styles.messageActions}>
                                    {isUserMessage ? null : (
                                      <>
                                        <Tooltip title={feedback === "like" ? "取消喜欢" : "喜欢"}>
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label={feedback === "like" ? "取消喜欢" : "喜欢这条回复"}
                                            className={`${styles.messageActionButton} ${
                                              feedback === "like" ? styles.messageActionButtonActive : ""
                                            }`}
                                            disabled={!effectiveMessageId || feedbackMutation.isPending}
                                            icon={<LikeOutlined />}
                                            onClick={() => handleFeedback(chatMessage, "like")}
                                          />
                                        </Tooltip>
                                        <Tooltip title={feedback === "dislike" ? "取消不喜欢" : "不喜欢"}>
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label={feedback === "dislike" ? "取消不喜欢" : "不喜欢这条回复"}
                                            className={`${styles.messageActionButton} ${
                                              feedback === "dislike" ? styles.messageActionButtonActive : ""
                                            }`}
                                            disabled={!effectiveMessageId || feedbackMutation.isPending}
                                            icon={<DislikeOutlined />}
                                            onClick={() => handleFeedback(chatMessage, "dislike")}
                                          />
                                        </Tooltip>
                                        <Tooltip title="重新生成">
                                          <Button
                                            type="text"
                                            size="small"
                                            aria-label="重新生成回复"
                                            className={styles.messageActionButton}
                                            disabled={isSending}
                                            icon={<RedoOutlined />}
                                            onClick={() => void regenerateMessage(chatMessage)}
                                          />
                                        </Tooltip>
                                      </>
                                    )}
                                    <Tooltip title="已复制" open={copiedMessageId === chatMessage.id ? true : undefined}>
                                      <Button
                                        type="text"
                                        size="small"
                                        aria-label="复制消息"
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
                            title="开始新的对话"
                            description={
                              <>
                                发送普通消息开始协作，或输入 <strong>@AI</strong> 触发流式回答。
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
                        title="还没有可用频道"
                        description="创建一个频道后，团队消息和 AI 对话都会在这里沉淀。"
                        action={
                          <Button icon={<PlusOutlined />} onClick={() => window.dispatchEvent(new CustomEvent("wade-ai:create-channel"))}>
                            新建 Chat
                          </Button>
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.composer}>
                {streamStatus?.channelId === selectedChannelId ? (
                  <div className={styles.composerStatus}>
                    <Bubble
                      content={`${streamStatus.agentName}${streamStatus.modelName ? ` · ${streamStatus.modelName}` : ""} 正在思考…`}
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
                          aria-label="频道消息"
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          loading={isSending}
                          value={draft}
                          disabled={!selectedChannel || isSending}
                          placeholder={
                            selectedChannel
                              ? `在 #${selectedChannel.name} 中发送消息，输入 @ 可提及 AI 或成员`
                              : "先选择频道"
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
                                  aria-label="插入表情"
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
                    输入 <strong>@</strong> 提及 AI 或成员，<strong>@AI</strong> 触发流式回答，Shift + Enter 换行。
                  </Typography.Text>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              className={styles.workspaceEmpty}
              align="left"
              icon={<TeamOutlined />}
              title="还没有 Workspace"
              description="创建后会自动把你加入为 OWNER，并生成默认的 #general 频道。"
              action={
                <Button type="primary" onClick={() => router.push("/")}>
                  前往创建 Workspace
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
