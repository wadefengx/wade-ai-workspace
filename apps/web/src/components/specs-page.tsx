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

type SpecListItem = {
  name: string;
  title: string;
};

type SpecDocument = {
  name: string;
  content: string;
};

const specsKeys = {
  list: ["docs", "specs"] as const,
  detail: (name: string | null) => ["docs", "specs", name] as const
};

function SpecsContent() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const specsQuery = useQuery({
    queryKey: specsKeys.list,
    queryFn: () => apiFetch<SpecListItem[]>("/docs/specs")
  });

  const specItems = useMemo(() => specsQuery.data ?? [], [specsQuery.data]);
  const activeSelectedName = useMemo(
    () => (specItems.some((item) => item.name === selectedName) ? selectedName : specItems[0]?.name ?? null),
    [selectedName, specItems]
  );

  const specDetailQuery = useQuery({
    queryKey: specsKeys.detail(activeSelectedName),
    queryFn: () => apiFetch<SpecDocument>(`/docs/specs/${activeSelectedName}`),
    enabled: !!activeSelectedName
  });

  return (
    <div className={styles.responsiveSplit}>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Specs</Typography.Title>
            <Typography.Text type="secondary">Select a phase specification to view its original Markdown content.</Typography.Text>
          </div>
        </div>

        {specsQuery.isLoading ? (
          <LoadingState compact title="Loading specs" description="Syncing specification documents for the current phase." />
        ) : specItems.length ? (
          <div className={styles.selectionList}>
            {specItems.map((item) => (
              <Button
                key={item.name}
                type={item.name === activeSelectedName ? "primary" : "default"}
                block
                className={styles.selectionButton}
                onClick={() => setSelectedName(item.name)}
              >
                {item.title}
              </Button>
            ))}
          </div>
        ) : (
          <EmptyState compact icon={<FolderOpenOutlined />} title="No specs available yet" description="Phase specifications added to the repository appear here automatically." />
        )}
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Content</Typography.Title>
            <Typography.Text type="secondary">
              {activeSelectedName ? activeSelectedName : "Select a spec file from the left."}
            </Typography.Text>
          </div>
        </div>

        {specDetailQuery.isLoading ? (
          <LoadingState compact title="Loading content" description="The selected spec source will appear shortly." />
        ) : specDetailQuery.data ? (
          <div className={styles.scrollPanel}>
            <MarkdownContent content={specDetailQuery.data.content} />
          </div>
        ) : (
          <EmptyState compact icon={<ReadOutlined />} title="Select a spec" description="Choose a phase specification from the left to view its full Markdown content." />
        )}
      </div>
    </div>
  );
}

export function SpecsPage() {
  return (
    <WorkspacePageFrame
      title="Specs"
      description="Browse phase specification documents in the repository to implement against them in the current workspace."
    >
      <SpecsContent />
    </WorkspacePageFrame>
  );
}
