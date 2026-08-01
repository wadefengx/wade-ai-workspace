"use client";

import {
  BookOutlined,
  BulbOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DownOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Dropdown, Form, Input, Modal, Select, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { WORKSPACE_ICONS, getWorkspaceIconLabel, renderWorkspaceIcon } from "../lib/workspace-icons";
import { buildWorkspaceHref } from "../lib/workspace-navigation";
import { useAuthStore } from "../stores/auth";
import { type ThemeMode, useThemeStore } from "../theme/store";
import {
  createChannel as requestCreateChannel,
  fetchChannels,
  fetchWorkspaces,
  useWorkspaceContext,
  workspaceKeys,
  type Channel,
  type Workspace
} from "./workspace-context";
import styles from "./workspace-shell.module.css";
import { EmptyState, LoadingState } from "./ui-state";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type NavItem = {
  key: "dashboard" | "knowledge" | "memory" | "members" | "agents" | "settings" | "specs" | "skills";
  label: string;
  icon: ReactNode;
  href?: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardOutlined />, href: "/dashboard" },
  { key: "knowledge", label: "Knowledge", icon: <BookOutlined />, href: "/knowledge" },
  { key: "memory", label: "Memory", icon: <DatabaseOutlined />, href: "/memory" },
  { key: "members", label: "Members", icon: <TeamOutlined />, href: "/members" },
  { key: "agents", label: "Agents", icon: <RobotOutlined />, href: "/agents" },
  { key: "settings", label: "Settings", icon: <SettingOutlined />, href: "/settings" },
  { key: "specs", label: "Specs", icon: <FileTextOutlined />, href: "/specs" },
  { key: "skills", label: "Skills", icon: <BulbOutlined />, href: "/skills" }
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type SidebarState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

type ChannelGroup = {
  key: string;
  label: string;
  channels: Channel[];
  sortOrder: number;
  sortTimestamp: number;
};

type WorkspaceFormValues = {
  name: string;
  icon: string;
};

const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      setCollapsed: (collapsed) => set({ collapsed })
    }),
    {
      name: "wade-ai-sidebar-collapsed",
      storage: createJSONStorage(() => localStorage)
    }
  )
);

function resolveActiveNavKey(pathname: string) {
  if (pathname === "/dashboard") {
    return "dashboard";
  }

  if (pathname === "/knowledge") {
    return "knowledge";
  }

  if (pathname === "/memory") {
    return "memory";
  }

  if (pathname === "/members") {
    return "members";
  }

  if (pathname === "/agents") {
    return "agents";
  }

  if (pathname === "/settings") {
    return "settings";
  }

  if (pathname === "/specs") {
    return "specs";
  }

  if (pathname === "/skills") {
    return "skills";
  }

  return null;
}

function resolveDocumentTitle(pathname: string) {
  if (pathname === "/") {
    return "Wade AI · Workspace";
  }

  if (pathname === "/dashboard") {
    return "Wade AI · Dashboard";
  }

  if (pathname === "/knowledge") {
    return "Wade AI · Knowledge";
  }

  if (pathname === "/memory") {
    return "Wade AI · Memory";
  }

  if (pathname === "/members") {
    return "Wade AI · Members";
  }

  if (pathname === "/agents") {
    return "Wade AI · Agents";
  }

  if (pathname === "/settings") {
    return "Wade AI · Settings";
  }

  if (pathname === "/specs") {
    return "Wade AI · Specs";
  }

  if (pathname === "/skills") {
    return "Wade AI · Skills";
  }

  return "Wade AI";
}

function formatRegisteredAt(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatMonthLabel(value: Date) {
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}

function resolveChannelGroup(channel: Channel, now: Date): Omit<ChannelGroup, "channels"> {
  if (!channel.lastMessageAt) {
    return {
      key: "no-messages",
      label: "暂无消息",
      sortOrder: 99,
      sortTimestamp: Number.NEGATIVE_INFINITY
    };
  }

  const timestamp = new Date(channel.lastMessageAt);

  if (Number.isNaN(timestamp.getTime())) {
    return {
      key: "no-messages",
      label: "暂无消息",
      sortOrder: 99,
      sortTimestamp: Number.NEGATIVE_INFINITY
    };
  }

  const dayDiff = Math.floor((startOfDay(now).getTime() - startOfDay(timestamp).getTime()) / DAY_IN_MS);

  if (dayDiff <= 0) {
    return {
      key: "today",
      label: "今天",
      sortOrder: 0,
      sortTimestamp: Number.POSITIVE_INFINITY
    };
  }

  if (dayDiff < 7) {
    return {
      key: "this-week",
      label: "一周前",
      sortOrder: 1,
      sortTimestamp: now.getTime() - 7 * DAY_IN_MS
    };
  }

  if (dayDiff < 30) {
    return {
      key: "this-month",
      label: "一月前",
      sortOrder: 2,
      sortTimestamp: now.getTime() - 30 * DAY_IN_MS
    };
  }

  return {
    key: `${timestamp.getFullYear()}-${timestamp.getMonth() + 1}`,
    label: formatMonthLabel(timestamp),
    sortOrder: 3,
    sortTimestamp: new Date(timestamp.getFullYear(), timestamp.getMonth(), 1).getTime()
  };
}

function compareChannelsByActivity(a: Channel, b: Channel) {
  const activityDiff =
    new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();

  if (activityDiff !== 0) {
    return activityDiff;
  }

  const createdAtDiff = new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return a.name.localeCompare(b.name);
}

function compareChannelGroups(a: ChannelGroup, b: ChannelGroup) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return b.sortTimestamp - a.sortTimestamp;
}

function resolveWorkspaceIconName(workspace?: { icon?: unknown } | null) {
  return typeof workspace?.icon === "string" && workspace.icon ? workspace.icon : "TeamOutlined";
}

function resolveThemeLabel(themeMode: ThemeMode, resolvedTheme: "light" | "dark") {
  if (themeMode === "system") {
    return `跟随系统（当前${resolvedTheme === "dark" ? "深色" : "浅色"}）`;
  }

  return resolvedTheme === "dark" ? "深色" : "浅色";
}

function resolveNextChatName(channels: Channel[]) {
  const maxIndex = channels.reduce((currentMax, channel) => {
    const match = channel.name.match(/^对话\s+(\d+)$/);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);

  return `对话 ${maxIndex + 1}`;
}

function BrandMark() {
  return (
    <svg className={styles.brandMark} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="workspace-wade-ai-gradient" x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#024AD8" />
          <stop offset="1" stopColor="#6A8DFF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#workspace-wade-ai-gradient)" />
      <path
        d="M18 19H46L26.5 45H46"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
    </svg>
  );
}

export function WorkspaceNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const themeMode = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const sidebarCollapsed = useSidebarStore((state) => state.collapsed);
  const setSidebarCollapsed = useSidebarStore((state) => state.setCollapsed);
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const {
    workspaceId,
    workspaces,
    workspacesLoading,
    selectedWorkspace,
    channels,
    channelsLoading,
    selectedChannelId,
    members
  } = useWorkspaceContext();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [collapsedChannelGroups, setCollapsedChannelGroups] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<{ chats: boolean; menu: boolean }>(() => {
    if (typeof window === "undefined") {
      return { chats: false, menu: false };
    }

    try {
      const raw = window.localStorage.getItem("wade-ai-collapsed-sections");
      return raw ? { chats: false, menu: false, ...JSON.parse(raw) } : { chats: false, menu: false };
    } catch {
      return { chats: false, menu: false };
    }
  });
  const [chatSearch, setChatSearch] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem("wade-ai-collapsed-sections", JSON.stringify(collapsedSections));
    } catch {
      // ignore persistence failures
    }
  }, [collapsedSections]);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [accountAnchor, setAccountAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [workspaceForm] = Form.useForm<WorkspaceFormValues>();
  const selectedWorkspaceIcon = Form.useWatch("icon", workspaceForm);
  const activeNavKey = useMemo(() => resolveActiveNavKey(pathname), [pathname]);
  const resolvedTheme = useMemo<"light" | "dark">(
    () => (themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode),
    [systemPrefersDark, themeMode]
  );
  const themeTooltip = useMemo(
    () => `当前主题：${resolveThemeLabel(themeMode, resolvedTheme)}`,
    [resolvedTheme, themeMode]
  );
  const currentMember = useMemo(
    () => members.find((member) => member.userId === user?.id) ?? null,
    [members, user?.id]
  );
  const userRole = useMemo(() => {
    if (!user) {
      return "-";
    }

    if ("role" in user && typeof user.role === "string") {
      return user.role;
    }

    return currentMember?.role ?? "USER";
  }, [currentMember?.role, user]);
  const filteredChannels = useMemo(() => {
    const keyword = chatSearch.trim().toLowerCase();

    if (!keyword) {
      return channels;
    }

    return channels.filter((channel) => channel.name.toLowerCase().includes(keyword));
  }, [channels, chatSearch]);
  const groupedChannels = useMemo<ChannelGroup[]>(() => {
    const now = new Date();
    const groups = new Map<string, ChannelGroup>();

    for (const channel of [...filteredChannels].sort(compareChannelsByActivity)) {
      const groupMeta = resolveChannelGroup(channel, now);
      const existingGroup = groups.get(groupMeta.key);

      if (existingGroup) {
        existingGroup.channels.push(channel);
        continue;
      }

      groups.set(groupMeta.key, {
        ...groupMeta,
        channels: [channel]
      });
    }

    return Array.from(groups.values()).sort(compareChannelGroups);
  }, [filteredChannels]);
  const workspaceMenuItems = useMemo<NonNullable<MenuProps["items"]>>(
    () =>
      workspaces.map((workspace) => ({
        key: workspace.id,
        label: (
          <span className={styles.workspaceOptionLabel}>
            <span className={styles.workspacePreviewIcon}>{renderWorkspaceIcon(resolveWorkspaceIconName(workspace))}</span>
            <span className={styles.workspaceOptionText}>{workspace.name}</span>
          </span>
        )
      })),
    [workspaces]
  );
  const workspaceMenu = useMemo<MenuProps>(
    () => ({
      items: workspaceMenuItems,
      onClick: ({ key }) => {
        router.push(
          buildWorkspaceHref(pathname, String(key), {
            channelId: selectedChannelId
          })
        );
      }
    }),
    [pathname, router, selectedChannelId, workspaceMenuItems]
  );
  const createWorkspaceMutation = useMutation({
    mutationFn: (values: WorkspaceFormValues) =>
      apiFetch<Workspace>("/workspaces", {
        method: "POST",
        body: values
      }),
    onSuccess: async (workspace, values) => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      const refreshed = await queryClient.fetchQuery({
        queryKey: workspaceKeys.all,
        queryFn: fetchWorkspaces
      });
      const nextWorkspace =
        refreshed.find((item) => item.id === workspace?.id) ??
        refreshed.find((item) => item.name === values.name) ??
        refreshed.at(-1);

      setWorkspaceModalOpen(false);
      workspaceForm.resetFields();
      message.success("Workspace 已创建");
      router.push(buildWorkspaceHref(pathname, nextWorkspace?.id ?? null));
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "创建 Workspace 失败");
    }
  });

  const createChannelMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      return requestCreateChannel(workspaceId, { name: resolveNextChatName(channels) });
    },
    onSuccess: async (channel) => {
      if (!workspaceId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) });
      await queryClient.fetchQuery({
        queryKey: workspaceKeys.channels(workspaceId),
        queryFn: () => fetchChannels(workspaceId)
      });
      message.success("对话已创建");
      router.push(buildWorkspaceHref("/", workspaceId, { channelId: channel.id }));
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "创建对话失败");
    }
  });
  const logoutMutation = useMutation({
    mutationFn: () =>
      apiFetch("/auth/logout", {
        method: "POST"
      }),
    onSettled: async () => {
      clearSession();
      await queryClient.cancelQueries();
      queryClient.clear();
      router.push("/login");
    }
  });
  const accountMenuItems = useMemo<NonNullable<MenuProps["items"]>>(
    () =>
      user
        ? [
            {
              key: "account-summary",
              disabled: true,
              label: (
                <div className={styles.accountMenuHeader}>
                  <Avatar size={40}>{user.name.slice(0, 1).toUpperCase()}</Avatar>
                  <div className={styles.accountMenuMeta}>
                    <span className={styles.accountMenuName}>{user.name}</span>
                    <span className={styles.accountMenuEmail}>{user.email}</span>
                  </div>
                </div>
              )
            },
            { type: "divider" },
            { key: "profile", label: "个人详情" },
            { key: "logout", danger: true, label: "退出登录" }
          ]
        : [],
    [user]
  );

  useEffect(() => {
    document.title = resolveDocumentTitle(pathname);
  }, [pathname]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    const handleAccountTriggerClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest(`.${styles.memberBar} .ant-btn`) as HTMLButtonElement | null;

      if (!trigger) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const { left, top, width, height } = trigger.getBoundingClientRect();
      setAccountAnchor({ left, top, width, height });
      setAccountMenuOpen(true);
    };

    document.addEventListener("click", handleAccountTriggerClick, true);

    return () => {
      document.removeEventListener("click", handleAccountTriggerClick, true);
    };
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    const closeMenu = () => {
      setAccountMenuOpen(false);
    };

    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (workspaceModalOpen) {
      workspaceForm.setFieldsValue({
        name: "",
        icon: "TeamOutlined"
      });
    }
  }, [workspaceForm, workspaceModalOpen]);

  useEffect(() => {
    const handleCreateChannel = () => {
      if (workspaceId && !createChannelMutation.isPending) {
        createChannelMutation.mutate();
      }
    };

    window.addEventListener("wade-ai:create-channel", handleCreateChannel);

    return () => {
      window.removeEventListener("wade-ai:create-channel", handleCreateChannel);
    };
  }, [createChannelMutation, workspaceId]);

  return (
    <>
      <aside className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
        <div className={`${styles.sidebarHeader} ${sidebarCollapsed ? styles.sidebarHeaderCollapsed : ""}`}>
          {sidebarCollapsed ? (
            <Tooltip title="Wade AI" placement="right">
              <div className={`${styles.brand} ${styles.brandCollapsed}`}>
                <BrandMark />
              </div>
            </Tooltip>
          ) : (
            <div className={styles.brand}>
              <BrandMark />
              <span className={styles.brandLabel}>Wade AI</span>
            </div>
          )}

          <div className={`${styles.sidebarActions} ${sidebarCollapsed ? styles.sidebarActionsCollapsed : ""}`}>
            {!sidebarCollapsed ? (
              <Tooltip title={themeTooltip} placement="bottom">
                <Button
                  className={styles.sidebarActionButton}
                  type="text"
                  aria-label={themeTooltip}
                  icon={resolvedTheme === "dark" ? <BulbOutlined /> : <SunOutlined />}
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                />
              </Tooltip>
            ) : null}
            <Tooltip title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"} placement="bottom">
              <Button
                className={styles.sidebarActionButton}
                type="text"
                aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
                icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            </Tooltip>
          </div>
        </div>

        <div className={styles.workspaceControls}>
          <div className={styles.sectionHeader}>
            {sidebarCollapsed ? (
              <Tooltip title={selectedWorkspace?.name ?? "Workspace"} placement="right">
                <span className={styles.sectionIcon}>{renderWorkspaceIcon(resolveWorkspaceIconName(selectedWorkspace))}</span>
              </Tooltip>
            ) : (
              <Typography.Text className={styles.sectionTitle}>Workspace</Typography.Text>
            )}
          </div>

          {sidebarCollapsed ? (
            <div className={styles.iconList}>
              <Dropdown menu={workspaceMenu} trigger={["click"]}>
                <Tooltip
                  title={
                    selectedWorkspace
                      ? `${selectedWorkspace.name} · ${getWorkspaceIconLabel(resolveWorkspaceIconName(selectedWorkspace))}`
                      : workspaces.length
                        ? "选择 Workspace"
                        : "暂无 Workspace"
                  }
                  placement="right"
                >
                  <Button
                    className={styles.workspaceIconButton}
                    type="text"
                    loading={workspacesLoading}
                    aria-label={
                      selectedWorkspace
                        ? `当前 Workspace：${selectedWorkspace.name}，打开切换菜单`
                        : "打开 Workspace 切换菜单"
                    }
                    icon={renderWorkspaceIcon(resolveWorkspaceIconName(selectedWorkspace))}
                  />
                </Tooltip>
              </Dropdown>
              <Tooltip title="新建 Workspace" placement="right">
                <Button
                  className={styles.iconOnlyButton}
                  type="text"
                  aria-label="新建 Workspace"
                  icon={<PlusOutlined />}
                  onClick={() => setWorkspaceModalOpen(true)}
                />
              </Tooltip>
            </div>
          ) : (
            <>
              <Select
                aria-label="选择 Workspace"
                placeholder={workspaces.length ? "选择 Workspace" : "暂无 Workspace"}
                value={workspaceId ?? undefined}
                options={workspaces.map((workspace) => ({
                  label: (
                    <span className={styles.workspaceOptionLabel}>
                      <span className={styles.workspacePreviewIcon}>
                        {renderWorkspaceIcon(resolveWorkspaceIconName(workspace))}
                      </span>
                      <span className={styles.workspaceOptionText}>{workspace.name}</span>
                    </span>
                  ),
                  value: workspace.id
                }))}
                loading={workspacesLoading}
                onChange={(value) =>
                  router.push(
                    buildWorkspaceHref(pathname, value, {
                      channelId: selectedChannelId
                    })
                  )
                }
              />
              <Button icon={<PlusOutlined />} aria-label="新建 Workspace" onClick={() => setWorkspaceModalOpen(true)}>
                新建 Workspace
              </Button>
            </>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            {sidebarCollapsed ? (
              <Tooltip title="Chats" placement="right">
                <span className={styles.sectionIcon}>
                  <MessageOutlined />
                </span>
              </Tooltip>
            ) : (
              <>
                <Button
                  className={styles.sectionCollapseToggle}
                  type="text"
                  aria-label={`${collapsedSections.chats ? "展开" : "折叠"} Chats 区域`}
                  onClick={() =>
                    setCollapsedSections((current) => ({ ...current, chats: !current.chats }))
                  }
                >
                  <DownOutlined
                    className={`${styles.channelGroupChevron} ${
                      collapsedSections.chats ? styles.channelGroupChevronCollapsed : ""
                    }`}
                  />
                </Button>
                <Typography.Text className={`${styles.sectionTitle} ${styles.sectionCollapseTitle}`}>Chats</Typography.Text>
              </>
            )}
            <Tooltip title="新建 Chat" placement={sidebarCollapsed ? "right" : "top"}>
              <Button
                className={sidebarCollapsed ? styles.hiddenOnCollapsed : ""}
                icon={<PlusOutlined />}
                size="small"
                type="text"
                aria-label="新建 Chat"
                disabled={!workspaceId || createChannelMutation.isPending}
                loading={createChannelMutation.isPending}
                onClick={() => createChannelMutation.mutate()}
              />
            </Tooltip>
          </div>

          {!sidebarCollapsed && !collapsedSections.chats ? (
            <Input
              allowClear
              className={styles.chatSearch}
              placeholder="搜索 Chats"
              prefix={<SearchOutlined />}
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
            />
          ) : null}

          {!collapsedSections.chats && (channelsLoading ? (
            <div className={styles.loadingBlock}>
              <LoadingState compact align="left" title="正在读取 Chats" description="同步频道列表与最近活跃时间。" />
            </div>
          ) : (
            <div className={styles.channelGroups}>
              {groupedChannels.map((group) => (
                <div key={group.key} className={styles.channelGroup}>
                  {!sidebarCollapsed ? (
                    <div className={styles.channelGroupHeader}>
                      <Button
                        className={styles.channelGroupToggle}
                        type="text"
                        aria-label={`${collapsedChannelGroups[group.key] ? "展开" : "折叠"} ${group.label} 频道分组`}
                        onClick={() =>
                          setCollapsedChannelGroups((current) => ({
                            ...current,
                            [group.key]: !current[group.key]
                          }))
                        }
                      >
                        <span className={styles.channelGroupTitle}>{group.label}</span>
                        <DownOutlined
                          className={`${styles.channelGroupChevron} ${
                            collapsedChannelGroups[group.key] ? styles.channelGroupChevronCollapsed : ""
                          }`}
                        />
                      </Button>
                    </div>
                  ) : null}
                  <div
                    className={`${styles.channelListCollapse} ${
                      !sidebarCollapsed && collapsedChannelGroups[group.key] ? styles.channelListCollapseCollapsed : ""
                    }`}
                  >
                    <div className={styles.channelListInner}>
                      <div className={styles.channelList}>
                        {group.channels.map((channel) => {
                          const button = (
                            <Button
                              key={channel.id}
                              className={`${styles.channelButton} ${
                                channel.id === selectedChannelId ? styles.channelButtonActive : ""
                              } ${sidebarCollapsed ? styles.channelButtonCollapsed : ""}`}
                              type="text"
                              aria-label={`打开频道 # ${channel.name}`}
                              onClick={() => router.push(buildWorkspaceHref("/", workspaceId, { channelId: channel.id }))}
                            >
                              <MessageOutlined />
                              {!sidebarCollapsed ? <span className={styles.channelLabel}># {channel.name}</span> : null}
                            </Button>
                          );

                          if (!sidebarCollapsed) {
                            return button;
                          }

                          return (
                            <Tooltip key={channel.id} title={`# ${channel.name}`} placement="right">
                              {button}
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!channels.length && !sidebarCollapsed ? (
                <EmptyState
                  compact
                  align="left"
                  icon={<MessageOutlined />}
                  title={workspaceId ? "还没有频道" : "先创建 Workspace"}
                  description={workspaceId ? "先创建一个 Chat 频道，消息与 AI 对话就会开始沉淀。" : "创建 Workspace 后，这里会自动出现频道列表。"}
                  action={
                    workspaceId ? (
                    <Button
                       size="small"
                       icon={<PlusOutlined />}
                       loading={createChannelMutation.isPending}
                       onClick={() => createChannelMutation.mutate()}
                    >
                        新建 Chat
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}
              {!!channels.length && !groupedChannels.length && !sidebarCollapsed ? (
                <EmptyState compact align="left" icon={<SearchOutlined />} title="没有匹配的 Chats" description="换个关键词试试，或清空搜索查看全部频道。" />
              ) : null}
            </div>
          ))}
        </div>

        <div className={styles.section}>
          {sidebarCollapsed ? (
            <Tooltip title="Workspace Menu" placement="right">
              <span className={styles.sectionIcon}>
                <SettingOutlined />
              </span>
            </Tooltip>
          ) : (
            <>
              <Button
                className={styles.sectionCollapseToggle}
                type="text"
                aria-label={`${collapsedSections.menu ? "展开" : "折叠"} Workspace Menu 区域`}
                onClick={() =>
                  setCollapsedSections((current) => ({ ...current, menu: !current.menu }))
                }
              >
                <DownOutlined
                  className={`${styles.channelGroupChevron} ${
                    collapsedSections.menu ? styles.channelGroupChevronCollapsed : ""
                  }`}
                />
              </Button>
              <Typography.Text className={`${styles.sectionTitle} ${styles.sectionCollapseTitle}`}>Workspace Menu</Typography.Text>
            </>
          )}
          {!collapsedSections.menu ? (
          <div className={styles.placeholderList}>            {navItems.map((item) => (
              <Tooltip key={item.key} title={sidebarCollapsed ? item.label : undefined} placement="right">
                <Button
                  className={`${styles.navButton} ${item.key === activeNavKey ? styles.channelButtonActive : ""} ${
                    sidebarCollapsed ? styles.navButtonCollapsed : ""
                  }`}
                  type="text"
                  aria-label={`打开 ${item.label}`}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled || !item.href) {
                      return;
                    }

                    router.push(
                      buildWorkspaceHref(item.href, workspaceId, {
                        channelId: selectedChannelId
                      })
                    );
                  }}
                >
                  {item.icon}
                  {!sidebarCollapsed ? item.label : null}
                </Button>
              </Tooltip>
            ))}
          </div>
          ) : null}
        </div>
      </aside>

      {accountAnchor && user ? (
        <Dropdown
          open={accountMenuOpen}
          trigger={[]}
          placement="bottomRight"
          onOpenChange={setAccountMenuOpen}
          menu={{
            items: accountMenuItems,
            onClick: ({ key }) => {
              if (key === "profile") {
                setAccountMenuOpen(false);
                setProfileModalOpen(true);
              }

              if (key === "logout") {
                setAccountMenuOpen(false);
                logoutMutation.mutate();
              }
            }
          }}
        >
          <span
            aria-hidden="true"
            className={styles.accountTriggerProxy}
            style={{
              left: accountAnchor.left,
              top: accountAnchor.top,
              width: accountAnchor.width,
              height: accountAnchor.height
            }}
          />
        </Dropdown>
      ) : null}

      <Modal
        destroyOnHidden
        open={workspaceModalOpen}
        title="创建 Workspace"
        okText="创建"
        confirmLoading={createWorkspaceMutation.isPending}
        onCancel={() => setWorkspaceModalOpen(false)}
        onOk={() => workspaceForm.submit()}
      >
        <Form
          form={workspaceForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ name: "", icon: "TeamOutlined" }}
          onFinish={(values) => createWorkspaceMutation.mutate(values)}
        >
          <Form.Item
            label="Workspace 名称"
            name="name"
            rules={[{ required: true, message: "请输入 Workspace 名称" }]}
          >
            <Input placeholder="例如：Product Team" />
          </Form.Item>
          <Form.Item label="Workspace Icon" name="icon" rules={[{ required: true, message: "请选择 Workspace Icon" }]}>
            <div className={styles.workspaceIconPickerGrid}>
              {WORKSPACE_ICONS.map((iconItem) => {
                const selected = selectedWorkspaceIcon === iconItem.key;

                return (
                  <button
                    key={iconItem.key}
                    className={`${styles.workspaceIconPickerButton} ${
                      selected ? styles.workspaceIconPickerButtonSelected : ""
                    }`}
                    type="button"
                    aria-label={`选择 ${iconItem.label} 图标`}
                    onClick={() => workspaceForm.setFieldValue("icon", iconItem.key)}
                  >
                    {iconItem.icon}
                  </button>
                );
              })}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        footer={null}
        open={profileModalOpen}
        title="个人详情"
        onCancel={() => setProfileModalOpen(false)}
      >
        {user ? (
          <div className={styles.accountProfile}>
            <Avatar size={72}>{user.name.slice(0, 1).toUpperCase()}</Avatar>
            <div className={styles.accountProfileMeta}>
              <div className={styles.accountProfileRow}>
                <span className={styles.accountProfileLabel}>用户名</span>
                <span className={styles.accountProfileValue}>{user.name}</span>
              </div>
              <div className={styles.accountProfileRow}>
                <span className={styles.accountProfileLabel}>邮箱</span>
                <span className={styles.accountProfileValue}>{user.email}</span>
              </div>
              <div className={styles.accountProfileRow}>
                <span className={styles.accountProfileLabel}>角色</span>
                <span className={styles.accountProfileValue}>{userRole}</span>
              </div>
              <div className={styles.accountProfileRow}>
                <span className={styles.accountProfileLabel}>注册时间</span>
                <span className={styles.accountProfileValue}>{formatRegisteredAt(user.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
