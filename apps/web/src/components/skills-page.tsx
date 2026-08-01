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
            <Typography.Text type="secondary">查看团队沉淀下来的通用技能与工作方式。</Typography.Text>
          </div>
        </div>

        {skillsQuery.isLoading ? (
          <LoadingState compact title="正在读取 Skills" description="同步团队沉淀下来的技能文档。" />
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
          <EmptyState compact icon={<FolderOpenOutlined />} title="还没有可用 Skills" description="把可复用方法沉淀到仓库后，这里会自动展示。" />
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
          <LoadingState compact title="正在读取内容" description="马上展示选中的 Skill 原文。" />
        ) : skillDetailQuery.data ? (
          <div className={styles.scrollPanel}>
            <MarkdownContent content={skillDetailQuery.data.content} />
          </div>
        ) : (
          <EmptyState compact icon={<ReadOutlined />} title="选择一个 Skill" description="从左侧挑一个技能文档后，这里会显示完整 Markdown 内容。" />
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
    >
      <SkillsContent />
    </WorkspacePageFrame>
  );
}
