"use client";

import { UserOutlined, DatabaseOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Dropdown, Grid, Typography } from "antd";
import type { MenuProps } from "antd";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import pageStyles from "./workspace-pages.module.css";
import shellStyles from "./workspace-shell.module.css";
import { EmptyState } from "./ui-state";
import { apiFetch } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { useWorkspacePageContext } from "./workspace-context";

type WorkspacePageFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  scrollableContent?: boolean;
};

export function WorkspacePageFrame({
  title,
  description,
  children,
  scrollableContent = false
}: WorkspacePageFrameProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const { selectedWorkspace, members } = useWorkspacePageContext();
  // 统一由 pageScrollBody 提供滚动,scrollableContent 保留兼容调用方
  void scrollableContent;

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
            {screens.md ? (
              <Avatar.Group max={{ count: 4 }}>
                {members.map((member) => (
                  <Avatar key={member.id}>{member.name.slice(0, 1).toUpperCase()}</Avatar>
                ))}
              </Avatar.Group>
            ) : null}

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
              <Button icon={<UserOutlined />} aria-label="打开账户菜单">
                {screens.sm ? user?.name ?? user?.email ?? "Account" : "账户"}
              </Button>
            </Dropdown>
          </div>
        </header>

        <main className={shellStyles.conversation}>
          {selectedWorkspace ? (
            <div className={pageStyles.pageScrollBody}>
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
            </div>
          ) : (
            <EmptyState
              className={shellStyles.workspaceEmpty}
              align="left"
              icon={<DatabaseOutlined />}
              title="还没有 Workspace"
              description="先创建一个 Workspace，随后就能在这里管理文档、技能和成员。"
              action={
                <Button type="primary" onClick={() => router.push("/")}>
                  返回 Workspace
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
