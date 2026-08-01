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
            <Typography.Text type="secondary">选择一个阶段规格查看原始 Markdown 内容。</Typography.Text>
          </div>
        </div>

        {specsQuery.isLoading ? (
          <LoadingState compact title="正在读取 Specs" description="同步当前阶段的规格文档。" />
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
          <EmptyState compact icon={<FolderOpenOutlined />} title="还没有可用 Specs" description="把阶段规格写入仓库后，这里会自动列出来。" />
        )}
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>内容</Typography.Title>
            <Typography.Text type="secondary">
              {activeSelectedName ? activeSelectedName : "先从左侧选择一个 Spec 文件。"}
            </Typography.Text>
          </div>
        </div>

        {specDetailQuery.isLoading ? (
          <LoadingState compact title="正在读取内容" description="马上展示选中的 Spec 原文。" />
        ) : specDetailQuery.data ? (
          <div className={styles.scrollPanel}>
            <MarkdownContent content={specDetailQuery.data.content} />
          </div>
        ) : (
          <EmptyState compact icon={<ReadOutlined />} title="选择一个 Spec" description="从左侧挑一个阶段规格后，这里会显示完整 Markdown 内容。" />
        )}
      </div>
    </div>
  );
}

export function SpecsPage() {
  return (
    <WorkspacePageFrame
      title="Specs"
      description="浏览仓库中的阶段规格文档，方便在当前 Workspace 内对照实施。"
    >
      <SpecsContent />
    </WorkspacePageFrame>
  );
}
