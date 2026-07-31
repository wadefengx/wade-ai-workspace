"use client";

import { Skeleton, Spin, Typography } from "antd";
import type { ReactNode } from "react";
import styles from "./ui-state.module.css";

type EmptyStateProps = {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  align?: "center" | "left";
  className?: string;
};

type LoadingStateProps = {
  title?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  fullscreen?: boolean;
  align?: "center" | "left";
  className?: string;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  align = "center",
  className
}: EmptyStateProps) {
  return (
    <div
      className={joinClassNames(
        styles.stateCard,
        compact && styles.stateCardCompact,
        align === "left" && styles.stateCardLeft,
        className
      )}
    >
      <div className={styles.stateIcon} aria-hidden="true">
        {icon}
      </div>
      <Typography.Title level={compact ? 5 : 4} className={styles.stateTitle}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" className={styles.stateDescription}>
        {description}
      </Typography.Paragraph>
      {action ? <div className={styles.stateAction}>{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  title = "正在加载内容",
  description = "请稍候，正在同步最新状态。",
  compact = false,
  fullscreen = false,
  align = "center",
  className
}: LoadingStateProps) {
  return (
    <div
      className={joinClassNames(
        styles.stateCard,
        styles.loadingBlock,
        compact && styles.stateCardCompact,
        fullscreen && styles.fullscreen,
        align === "left" && styles.stateCardLeft,
        className
      )}
    >
      <div className={joinClassNames(styles.loadingHeader, align === "left" && styles.loadingHeaderLeft)}>
        <Spin size={compact ? "default" : "large"} />
        <Typography.Title level={compact ? 5 : 4} className={styles.loadingTitle}>
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary" className={styles.loadingDescription}>
          {description}
        </Typography.Paragraph>
      </div>
      <Skeleton
        active
        title={false}
        paragraph={{
          rows: compact ? 2 : 3
        }}
        className={styles.loadingSkeleton}
      />
    </div>
  );
}
