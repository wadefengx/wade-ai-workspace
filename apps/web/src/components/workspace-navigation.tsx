"use client";

import {
  BookOutlined,
  DatabaseOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Select, Spin, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { buildWorkspaceHref } from "../lib/workspace-navigation";
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
  key: "knowledge" | "memory" | "members" | "agents" | "settings";
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
  { key: "settings", label: "Settings", icon: <SettingOutlined />, disabled: true }
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

  return null;
}

export function WorkspaceNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const {
    workspaceId,
    workspaces,
    workspacesLoading,
    channels,
    channelsLoading,
    selectedChannelId
  } = useWorkspaceContext();
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [workspaceForm] = Form.useForm<{ name: string }>();
  const [channelForm] = Form.useForm<{ name: string }>();
  const activeNavKey = useMemo(() => resolveActiveNavKey(pathname), [pathname]);

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

  return (
    <>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <RobotOutlined />
          <span>Wade AI</span>
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
    </>
  );
}
