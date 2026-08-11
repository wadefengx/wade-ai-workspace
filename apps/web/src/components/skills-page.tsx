"use client";

import { FolderOpenOutlined, ReadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Typography } from "antd";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { MarkdownContent } from "./markdown-content";
import { EmptyState, LoadingState } from "./ui-state";
import { WorkspacePageFrame } from "./workspace-page-frame";
import styles from "./workspace-pages.module.css";

type SkillListItem = {
  name: string;
  description: string;
};

type SkillDocument = {
  name: string;
  content: string;
};

const skillsKeys = {
  list: ["docs", "skills"] as const,
  detail: (name: string | null) => ["docs", "skills", name] as const
};

function SkillsContent() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const skillsQuery = useQuery({
    queryKey: skillsKeys.list,
    queryFn: () => apiFetch<SkillListItem[]>("/docs/skills")
  });

  const skillItems = useMemo(() => skillsQuery.data ?? [], [skillsQuery.data]);
  const activeSelectedName = useMemo(
    () => (skillItems.some((item) => item.name === selectedName) ? selectedName : skillItems[0]?.name ?? null),
    [selectedName, skillItems]
  );

  const skillDetailQuery = useQuery({
    queryKey: skillsKeys.detail(activeSelectedName),
    queryFn: () => apiFetch<SkillDocument>(`/docs/skills/${activeSelectedName}`),
    enabled: !!activeSelectedName
  });

  return (
    <div className={styles.responsiveSplit}>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Skills</Typography.Title>
            <Typography.Text type="secondary">View the reusable skills and ways of working established by the team.</Typography.Text>
          </div>
        </div>

        {skillsQuery.isLoading ? (
          <LoadingState compact title="Loading skills" description="Syncing the team’s skill documents." />
        ) : skillItems.length ? (
          <div className={styles.selectionList}>
            {skillItems.map((item) => (
              <Button
                key={item.name}
                type={item.name === activeSelectedName ? "primary" : "default"}
                block
                className={styles.selectionButton}
                onClick={() => setSelectedName(item.name)}
              >
                <div className={styles.selectionMeta}>
                  <span>{item.name}</span>
                  <span className={styles.selectionDescription}>{item.description}</span>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<FolderOpenOutlined />} title="No skills available yet" description="Reusable methods added to the repository appear here automatically." />
        )}
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Content</Typography.Title>
            <Typography.Text type="secondary">
              {activeSelectedName ? activeSelectedName : "Select a skill file from the left."}
            </Typography.Text>
          </div>
        </div>

        {skillDetailQuery.isLoading ? (
          <LoadingState compact title="Loading content" description="The selected skill source will appear shortly." />
        ) : skillDetailQuery.data ? (
          <div className={styles.scrollPanel}>
            <MarkdownContent content={skillDetailQuery.data.content} />
          </div>
        ) : (
          <EmptyState compact icon={<ReadOutlined />} title="Select a skill" description="Choose a skill document from the left to view its full Markdown content." />
        )}
      </div>
    </div>
  );
}

export function SkillsPage() {
  return (
    <WorkspacePageFrame
      title="Skills"
      description="Browse shared team skill documents to align implementation in the current workspace."
    >
      <SkillsContent />
    </WorkspacePageFrame>
  );
}
