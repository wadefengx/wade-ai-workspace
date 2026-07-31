"use client";

import {
  BookOutlined,
  BulbOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Avatar, Button, Dropdown, Form, Input, Modal, Select, Spin, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { buildWorkspaceHref } from "../lib/workspace-navigation";
import { useAuthStore } from "../stores/auth";
import {
  fetchChannels,
  fetchWorkspaces,
  useWorkspaceContext,
  workspaceKeys,
  type Channel,
  type Workspace
} from "./workspace-context";
import styles from "./workspace-shell.module.css";

type NavItem = {
  key: "knowledge" | "memory" | "members" | "agents" | "settings" | "specs" | "skills";
  label: string;
  icon: ReactNode;
  href?: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { key: "knowledge", label: "Knowledge", icon: <BookOutlined />, href: "/knowledge" },
  { key: "memory", label: "Memory", icon: <DatabaseOutlined />, href: "/memory" },
  { key: "members", label: "Members", icon: <TeamOutlined />, href: "/members" },
  { key: "agents", label: "Agents", icon: <RobotOutlined />, href: "/agents" },
  { key: "settings", label: "Settings", icon: <SettingOutlined />, href: "/settings" },
  { key: "specs", label: "Specs", icon: <FileTextOutlined />, href: "/specs" },
  { key: "skills", label: "Skills", icon: <BulbOutlined />, href: "/skills" }
];

function resolveActiveNavKey(pathname: string) {
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
    return "Zone AI · Workspace";
  }

  if (pathname === "/knowledge") {
    return "Zone AI · Knowledge";
  }

  if (pathname === "/memory") {
    return "Zone AI · Memory";
  }

  if (pathname === "/members") {
    return "Zone AI · Members";
  }

  if (pathname === "/agents") {
    return "Zone AI · Agents";
  }

  if (pathname === "/settings") {
    return "Zone AI · Settings";
  }

  if (pathname === "/specs") {
    return "Zone AI · Specs";
  }

  if (pathname === "/skills") {
    return "Zone AI · Skills";
  }

  return "Zone AI";
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

function BrandMark() {
  return (
    <svg className={styles.brandMark} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="workspace-zone-ai-gradient" x1="10" y1="8" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#024AD8" />
          <stop offset="1" stopColor="#6A8DFF" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#workspace-zone-ai-gradient)" />
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
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const {
    workspaceId,
    workspaces,
    workspacesLoading,
    channels,
    channelsLoading,
    selectedChannelId,
    members
  } = useWorkspaceContext();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [workspaceForm] = Form.useForm<{ name: string }>();
  const [channelForm] = Form.useForm<{ name: string }>();
  const activeNavKey = useMemo(() => resolveActiveNavKey(pathname), [pathname]);
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

  const createWorkspaceMutation = useMutation({
    mutationFn: (values: { name: string }) =>
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
    mutationFn: (values: { name: string }) => {
      if (!workspaceId) {
        throw new Error("缺少 Workspace");
      }

      return apiFetch<Channel>(`/workspaces/${workspaceId}/channels`, {
        method: "POST",
        body: values
      });
    },
    onSuccess: async (channel, values) => {
      if (!workspaceId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: workspaceKeys.channels(workspaceId) });
      const refreshed = await queryClient.fetchQuery({
        queryKey: workspaceKeys.channels(workspaceId),
        queryFn: () => fetchChannels(workspaceId)
      });
      const nextChannel =
        refreshed.find((item) => item.id === channel?.id) ??
        refreshed.find((item) => item.name === values.name) ??
        refreshed.at(-1);

      setChannelModalOpen(false);
      channelForm.resetFields();
      message.success("频道已创建");
      router.push(buildWorkspaceHref("/", workspaceId, { channelId: nextChannel?.id ?? null }));
    },
    onError: (error) => {
      message.error(error instanceof ApiError ? error.message : "创建频道失败");
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

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark />
          <span>Zone AI</span>
        </div>

        <div className={styles.workspaceControls}>
          <Typography.Text className={styles.sectionTitle}>Workspace</Typography.Text>
          <Select
            placeholder={workspaces.length ? "选择 Workspace" : "暂无 Workspace"}
            value={workspaceId ?? undefined}
            options={workspaces.map((workspace) => ({
              label: workspace.name,
              value: workspace.id
            }))}
            loading={workspacesLoading}
            onChange={(value) => router.push(buildWorkspaceHref(pathname, value))}
          />
          <Button icon={<PlusOutlined />} onClick={() => setWorkspaceModalOpen(true)}>
            新建 Workspace
          </Button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <Typography.Text className={styles.sectionTitle}>Channels</Typography.Text>
            <Button
              icon={<PlusOutlined />}
              size="small"
              type="text"
              disabled={!workspaceId}
              onClick={() => setChannelModalOpen(true)}
            />
          </div>

          {channelsLoading ? (
            <div className={styles.loadingBlock}>
              <Spin />
            </div>
          ) : (
            <div className={styles.channelList}>
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  className={`${styles.channelButton} ${
                    channel.id === selectedChannelId ? styles.channelButtonActive : ""
                  }`}
                  type="text"
                  onClick={() => router.push(buildWorkspaceHref("/", workspaceId, { channelId: channel.id }))}
                >
                  # {channel.name}
                </Button>
              ))}
              {!channels.length ? (
                <Typography.Text type="secondary">
                  {workspaceId ? "还没有频道，先创建一个。" : "先创建 Workspace。"}
                </Typography.Text>
              ) : null}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <Typography.Text className={styles.sectionTitle}>Workspace Menu</Typography.Text>
          <div className={styles.placeholderList}>
            {navItems.map((item) => (
              <Button
                key={item.key}
                className={`${styles.navButton} ${item.key === activeNavKey ? styles.channelButtonActive : ""}`}
                type="text"
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
                {item.label}
              </Button>
            ))}
          </div>
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
          onFinish={(values) => createWorkspaceMutation.mutate(values)}
        >
          <Form.Item
            label="Workspace 名称"
            name="name"
            rules={[{ required: true, message: "请输入 Workspace 名称" }]}
          >
            <Input placeholder="例如：Product Team" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        destroyOnHidden
        open={channelModalOpen}
        title="创建频道"
        okText="创建"
        confirmLoading={createChannelMutation.isPending}
        onCancel={() => setChannelModalOpen(false)}
        onOk={() => channelForm.submit()}
      >
        <Form
          form={channelForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => createChannelMutation.mutate(values)}
        >
          <Form.Item
            label="频道名称"
            name="name"
            rules={[{ required: true, message: "请输入频道名称" }]}
          >
            <Input placeholder="例如：product-updates" />
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
