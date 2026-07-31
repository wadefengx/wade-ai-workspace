"use client";

import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Spin, Typography } from "antd";
import { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { MarkdownContent } from "./markdown-content";
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
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "240px minmax(0, 1fr)" }}>
      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>Skills</Typography.Title>
            <Typography.Text type="secondary">查看团队沉淀下来的通用技能与工作方式。</Typography.Text>
          </div>
        </div>

        {skillsQuery.isLoading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : skillItems.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {skillItems.map((item) => (
              <Button
                key={item.name}
                type={item.name === activeSelectedName ? "primary" : "default"}
                block
                style={{ height: "auto", textAlign: "left", whiteSpace: "normal" }}
                onClick={() => setSelectedName(item.name)}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <span>{item.name}</span>
                  <span style={{ fontSize: 12, opacity: 0.72 }}>{item.description}</span>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有可用 Skills。" />
        )}
      </div>

      <div className={styles.pageCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.helperStack}>
            <Typography.Title level={5}>内容</Typography.Title>
            <Typography.Text type="secondary">
              {activeSelectedName ? activeSelectedName : "先从左侧选择一个 Skill 文件。"}
            </Typography.Text>
          </div>
        </div>

        {skillDetailQuery.isLoading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : skillDetailQuery.data ? (
          <div style={{ overflowX: "auto" }}>
            <MarkdownContent content={skillDetailQuery.data.content} />
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个 Skill 后在这里查看内容。" />
        )}
      </div>
    </div>
  );
}

export function SkillsPage() {
  return (
    <WorkspacePageFrame
      title="Skills"
      description="浏览团队共用技能文档，在当前 Workspace 里快速对齐实现方式。"
      contextTitle="Skill Context"
      contextDescription="Skills 用于沉淀可复用的方法和约定；这里直接渲染仓库中的 Markdown 原文。"
    >
      <SkillsContent />
    </WorkspacePageFrame>
  );
}
