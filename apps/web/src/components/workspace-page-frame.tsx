"use client";

import { BookOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Dropdown, Typography } from "antd";
import type { MenuProps } from "antd";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import pageStyles from "./workspace-pages.module.css";
import shellStyles from "./workspace-shell.module.css";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { useWorkspacePageContext } from "./workspace-context";

type WorkspacePageFrameProps = {
  title: string;
  description: string;
  contextTitle: string;
  contextDescription: string;
  children: ReactNode;
};

export function WorkspacePageFrame({
  title,
  description,
  contextTitle,
  contextDescription,
  children
}: WorkspacePageFrameProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const { workspaceId, selectedWorkspace, members, membersLoading } = useWorkspacePageContext();

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

  return (
    <div className={shellStyles.main}>
      <div className={shellStyles.center}>
        <header className={shellStyles.topbar}>
          <div className={shellStyles.workspaceMeta}>
            <Typography.Title level={4} className={shellStyles.topbarTitle}>
              {selectedWorkspace?.name ?? "创建你的第一个 Workspace"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {selectedWorkspace ? description : "先创建 Workspace，再管理知识库与记忆。"}
            </Typography.Text>
          </div>

          <div className={shellStyles.memberBar}>
            <Avatar.Group max={{ count: 4 }}>
              {members.map((member) => (
                <Avatar key={member.id}>{member.name.slice(0, 1).toUpperCase()}</Avatar>
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
              <Button icon={<UserOutlined />}>{user?.name ?? user?.email ?? "Account"}</Button>
            </Dropdown>
          </div>
        </header>

        <main className={shellStyles.conversation}>
          {selectedWorkspace ? (
            <div className={pageStyles.pageStack}>
              <div className={pageStyles.pageHeader}>
                <div>
                  <Typography.Title level={3} className={shellStyles.channelTitle}>
                    {title}
                  </Typography.Title>
                  <Typography.Text type="secondary">{description}</Typography.Text>
                </div>
              </div>
              {children}
            </div>
          ) : (
            <div className={shellStyles.workspaceEmpty}>
              <Typography.Title level={3}>还没有 Workspace</Typography.Title>
              <Typography.Paragraph type="secondary">
                先创建 Workspace，随后就能在这里管理文档和记忆。
              </Typography.Paragraph>
              <Button type="primary" onClick={() => router.push("/")}>
                返回 Workspace
              </Button>
            </div>
          )}
        </main>
      </div>

      <aside className={shellStyles.contextPanel}>
        <div className={shellStyles.contextStack}>
          <div className={shellStyles.contextCard}>
            <Typography.Title level={5}>{contextTitle}</Typography.Title>
            <div className={shellStyles.contextItem}>
              <BookOutlined />
              {selectedWorkspace ? selectedWorkspace.name : "等待 Workspace 创建"}
            </div>
            <Typography.Paragraph type="secondary">{contextDescription}</Typography.Paragraph>
          </div>

          <div className={shellStyles.contextCard}>
            <Typography.Title level={5}>Workspace Members</Typography.Title>
            <div className={shellStyles.contextItem}>
              <TeamOutlined />
              {workspaceId
                ? membersLoading
                  ? "读取成员中"
                  : `${members.length} 位成员`
                : "等待 Workspace 创建"}
            </div>
            <Typography.Paragraph type="secondary">
              当前页面保留与聊天工作台一致的上下文骨架，方便在各个 tab 间切换。
            </Typography.Paragraph>
          </div>
        </div>
      </aside>
    </div>
  );
}
