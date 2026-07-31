"use client";

import {
  LoadingOutlined,
  RobotOutlined,
  SmileOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Dropdown, Popover, Spin, Tag, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { Sender, Suggestion } from "@ant-design/x";
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
import { useWorkspaceContext } from "./workspace-context";
import { ApiError, apiFetch, resolveApiUrl } from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { streamSse } from "../lib/sse";
import { useAuthStore } from "../stores/auth";
import styles from "./workspace-shell.module.css";

type MessageSenderType = "USER" | "AGENT";
type MessageStatus = "PENDING" | "STREAMING" | "COMPLETED" | "FAILED";

type ChatMessage = {
  id: string;
  channelId: string;
  senderType: MessageSenderType;
  senderId: string | null;
  content: string;
  status: MessageStatus;
  createdAt: string;
};

type LocalChatMessage = ChatMessage & {
  errorMessage?: string;
  optimistic?: boolean;
  persistedId?: string;
  requestContent?: string;
};

type ChannelMessagesResponse = {
  items: ChatMessage[];
  nextCursor: string | null;
};

type StreamEventPayload =
  | {
      type: "token";
      content: string;
    }
  | {
      type: "done";
      messageId: string;
    }
  | {
      type: "error";
      message: string;
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
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { selectedWorkspace, selectedChannel, selectedChannelId, members } = useWorkspaceContext();
  const accessToken = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const [draftState, setDraftState] = useState<{ channelId: string | null; value: string }>({
    channelId: null,
    value: ""
  });
  const [isSending, setIsSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<ComponentRef<typeof Sender> | null>(null);
  const suggestionOpenRef = useRef(false);
  const scrollRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const autoScrolledChannelRef = useRef<string | null>(null);
  const activeStreamAbortRef = useRef<AbortController | null>(null);
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

  const logoutMutation = useMutation({
    mutationFn: () =>
      apiFetch("/auth/logout", {
        method: "POST"
      }),
    onSettled: async () => {
      clearSession();
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace("/login");
    }
  });

  const userMenuItems = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "logout",
        label: "退出登录"
      }
    ],
    []
  );

  const scrollToBottom = useCallback(() => {
    if (!messagesContainerRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    });
  }, []);

  const removeLocalMessage = useCallback((messageId: string) => {
    setLocalMessages((current) => current.filter((item) => item.id !== messageId));
  }, []);

  const patchLocalMessage = useCallback((messageId: string, updater: (message: LocalChatMessage) => LocalChatMessage) => {
    setLocalMessages((current) => current.map((item) => (item.id === messageId ? updater(item) : item)));
  }, []);

  const refetchCurrentMessages = useCallback(async () => {
    if (!selectedChannelId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: chatKeys.messages(selectedChannelId) });
    await messagesQuery.refetch();
  }, [messagesQuery, queryClient, selectedChannelId]);

  const streamAgentReply = useCallback(
    async (channelId: string, content: string, localAgentMessageId: string) => {
      if (!accessToken) {
        throw new Error("登录状态已失效，请重新登录");
      }

      const abortController = new AbortController();
      activeStreamAbortRef.current?.abort();
      activeStreamAbortRef.current = abortController;
      let doneMessageId: string | null = null;
      let streamErrorMessage: string | null = null;

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

            if (payload.type === "token") {
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                content: `${current.content}${payload.content}`,
                status: "STREAMING"
              }));
              scrollToBottom();
              return;
            }

            if (payload.type === "done") {
              doneMessageId = payload.messageId;
              patchLocalMessage(localAgentMessageId, (current) => ({
                ...current,
                persistedId: payload.messageId,
                status: "COMPLETED"
              }));
              return;
            }

            streamErrorMessage = payload.message;
            patchLocalMessage(localAgentMessageId, (current) => ({
              ...current,
              errorMessage: payload.message,
              status: "FAILED"
            }));
            throw new Error(payload.message);
          }
        });

        if (doneMessageId) {
          await refetchCurrentMessages();
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
      }
    },
    [accessToken, patchLocalMessage, refetchCurrentMessages, removeLocalMessage, scrollToBottom]
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

      scrollToBottom();

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
            requestContent: content
          });

          setLocalMessages((current) => {
            const next = options?.streamOnly && options.retryMessageId
              ? current.filter((item) => item.id !== options.retryMessageId)
              : current;
            return [...next, localAgentMessage];
          });
          scrollToBottom();
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
      scrollToBottom,
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
  }, [selectedChannelId]);

  useEffect(
    () => () => {
      activeStreamAbortRef.current?.abort();
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
    scrollToBottom();
  }, [channelMessages.length, messagesQuery.isLoading, scrollToBottom, selectedChannelId]);

  const handleMessagesScroll = useCallback(() => {
    if (!messagesContainerRef.current || !messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return;
    }

    if (messagesContainerRef.current.scrollTop > 48) {
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
            <Avatar.Group max={{ count: 4 }}>
              {members.map((member) => (
                <Tooltip key={member.id} title={`${member.name} · ${member.role}`}>
                  <Avatar>{member.name.slice(0, 1).toUpperCase()}</Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>

            <Dropdown
              menu={{
                items: userMenuItems,
                onClick: ({ key }) => {
                  if (key === "logout") {
                    logoutMutation.mutate();
                  }
                }
              }}
              trigger={["click"]}
            >
              <Button icon={<UserOutlined />}>{user.name ?? user.email}</Button>
            </Dropdown>
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
                          <Spin />
                        </div>
                      ) : channelMessages.length ? (
                        <div className={styles.messageList}>
                          {channelMessages.map((chatMessage) => {
                            const statusLabel = getStatusLabel(chatMessage);
                            const isUserMessage = chatMessage.senderType === "USER";
                            const isFailed = chatMessage.status === "FAILED";

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
                                    <span className={styles.messageAuthor}>{isUserMessage ? user.name || "You" : "AI Agent"}</span>
                                    <span className={styles.messageTimestamp}>{formatMessageTime(chatMessage.createdAt)}</span>
                                    {statusLabel ? <span className={styles.messageStatus}>{statusLabel}</span> : null}
                                  </div>

                                  {chatMessage.senderType === "AGENT" ? (
                                    <div className={styles.markdown}>
                                      <ReactMarkdown>{chatMessage.content || " "}</ReactMarkdown>
                                      {chatMessage.status === "STREAMING" ? (
                                        <span className={styles.streamCursor} aria-hidden="true" />
                                      ) : null}
                                    </div>
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
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className={styles.emptyState}>
                          <div className={styles.emptyCard}>
                            <div className={styles.emptyIcon}>
                              <RobotOutlined />
                            </div>
                            <Typography.Title level={3}>频道已就绪，等待首条消息</Typography.Title>
                            <Typography.Paragraph type="secondary">
                              发送普通消息开始协作，或输入 <strong>@AI</strong> 触发流式回答。
                            </Typography.Paragraph>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyCard}>
                        <Typography.Title level={3}>选择一个频道开始聊天</Typography.Title>
                        <Typography.Paragraph type="secondary">
                          当前 Workspace 已就绪，切换到左侧频道即可查看消息历史并开始对话。
                        </Typography.Paragraph>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.composer}>
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
                          suffix={
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
                          }
                        />
                      );
                    }}
                  </Suggestion>
                  <Typography.Text type="secondary" className={styles.composerHint}>
                    输入 <strong>@</strong> 提及 AI 或成员，<strong>@AI</strong> 触发流式回答，Shift + Enter 换行。
                  </Typography.Text>
                </div>
                <Button
                  type="primary"
                  loading={isSending}
                  disabled={!selectedChannel || !draft.trim() || isSending}
                  onClick={handleSubmit}
                >
                  发送
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.workspaceEmpty}>
              <Typography.Title level={3}>还没有 Workspace</Typography.Title>
              <Typography.Paragraph type="secondary">
                创建后会自动把你加入为 OWNER，并生成默认的 #general 频道。
              </Typography.Paragraph>
            </div>
          )}
        </main>
      </div>

      <aside className={styles.contextPanel}>
        <div className={styles.contextStack}>
          <div className={styles.contextCard}>
            <Typography.Title level={5}>AI Context</Typography.Title>
            <div className={styles.contextItem}>
              <RobotOutlined />
              Default Chat Agent
            </div>
            <Typography.Paragraph type="secondary">
              当前支持频道内 <strong>@AI</strong> 流式回答；Memory、Knowledge 与模型配置页留给后续 Phase。
            </Typography.Paragraph>
          </div>

          <div className={styles.contextCard}>
            <Typography.Title level={5}>Workspace Members</Typography.Title>
            <div className={styles.contextItem}>
              <TeamOutlined />
              {selectedWorkspace ? `${members.length} 位成员` : "等待 Workspace 创建"}
            </div>
            <Typography.Paragraph type="secondary">
              右侧面板继续保留工作台布局骨架，后续再接入更多上下文细节。
            </Typography.Paragraph>
          </div>
        </div>
      </aside>
    </div>
  );
}
