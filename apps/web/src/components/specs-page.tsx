"use client";

import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Spin, Typography } from "antd";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { MarkdownContent } from "./markdown-content";
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
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "240px minmax(0, 1fr)" }}>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Specs</Typography.Title>
            <Typography.Text type="secondary">选择一个阶段规格查看原始 Markdown 内容。</Typography.Text>
          </div>
        </div>

        {specsQuery.isLoading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : specItems.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {specItems.map((item) => (
              <Button
                key={item.name}
                type={item.name === activeSelectedName ? "primary" : "default"}
                block
                style={{ height: "auto", textAlign: "left", whiteSpace: "normal" }}
                onClick={() => setSelectedName(item.name)}
              >
                {item.title}
              </Button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有可用 Specs。" />
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
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : specDetailQuery.data ? (
          <div style={{ overflowX: "auto" }}>
            <MarkdownContent content={specDetailQuery.data.content} />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个 Spec 后在这里查看内容。" />
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
      contextTitle="Spec Context"
      contextDescription="Specs 是当前团队的实施契约；这里展示的是仓库内保存的原始 Markdown 版本。"
    >
      <SpecsContent />
    </WorkspacePageFrame>
  );
}
