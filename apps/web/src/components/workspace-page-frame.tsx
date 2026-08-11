"use client";

import { DatabaseOutlined } from "@ant-design/icons";
import { Avatar, Button, Grid, Typography } from "antd";
import type { ReactNode } from "react";
import pageStyles from "./workspace-pages.module.css";
import shellStyles from "./workspace-shell.module.css";
import { EmptyState } from "./ui-state";
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
  const screens = Grid.useBreakpoint();
  const { selectedWorkspace, members } = useWorkspacePageContext();
  // pageScrollBody provides scrolling; scrollableContent remains for compatibility.
  void scrollableContent;

  return (
    <div className={shellStyles.main}>
      <div className={shellStyles.center}>
        <header className={shellStyles.topbar}>
          <div className={shellStyles.workspaceMeta}>
            <Typography.Title level={4} className={shellStyles.topbarTitle}>
              {selectedWorkspace?.name ?? "Create your first workspace"}
            </Typography.Title>
            <Typography.Text type="secondary">
              {selectedWorkspace ? description : "Create a workspace before managing knowledge and memory."}
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
              title="No workspace yet"
              description="Create a workspace to manage documents, skills, and members here."
              action={
                <Button type="primary" onClick={() => window.location.assign("/")}>
                  Back to workspace
                </Button>
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}
