"use client";

import {
  ApartmentOutlined,
  ArrowUpOutlined,
  AuditOutlined,
  BookOutlined,
  BuildOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  LikeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SmileOutlined,
  ToolOutlined
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Progress, Skeleton, Space, Tag, Typography } from "antd";
import { animate, motion, useInView } from "framer-motion";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";
import { formatDateTime } from "../lib/datetime";
import { EmptyState } from "./ui-state";
import { WorkspacePageFrame } from "./workspace-page-frame";
import styles from "./dashboard-page.module.css";

type LaneStatus = "ready" | "running" | "review" | "qa" | "done" | string;
type PipelineStatus = "done" | "running" | "pending" | string;

type OrganizationStats = {
  assets?: Partial<Record<AssetKey, number>>;
  lanes?: Array<{
    id: string;
    title: string;
    status: LaneStatus;
    confidence: number;
    agent?: string;
  }>;
  pipeline?: Array<{
    stage: string;
    status: PipelineStatus;
  }>;
  improvements?: Partial<Record<ImprovementKey, number>>;
};

type FeedbackStats = {
  total?: number;
  like?: number;
  dislike?: number;
  ratio?: number;
  byChannel?: Array<{
    channelId: string;
    channelName: string;
    total: number;
    like: number;
  }>;
  byDay?: Array<{
    date: string;
    total: number;
    like: number;
  }>;
};

type MetricDefinition = {
  key: string;
  label: string;
  icon: ReactNode;
};

type AssetKey = "skills" | "specs" | "memory" | "adr" | "harness" | "knowledge";
type ImprovementKey = "skills" | "specs" | "memory" | "adr" | "harness" | "knowledge";

const organizationKeys = {
  stats: ["stats", "organization"] as const
};

const feedbackKeys = {
  stats: ["stats", "feedback"] as const
};

const roleItems = [
  {
    key: "pm",
    label: "PM",
    detail: "Break down goals, define scope, and align acceptance criteria."
  },
  {
    key: "fe",
    label: "FE",
    detail: "Build pages, manage state, and refine interactions."
  },
  {
    key: "be",
    label: "BE",
    detail: "Honor contracts, aggregate data, and stabilize interfaces."
  },
  {
    key: "qa",
    label: "QA",
    detail: "Watch regressions, cover scenarios, and reduce risk."
  },
  {
    key: "ux",
    label: "UX",
    detail: "Create hierarchy, tune pacing, and assess usability."
  },
  {
    key: "architect",
    label: "Architect",
    detail: "Control boundaries, preserve reuse, and reduce complexity."
  }
] as const;

const assetDefinitions: MetricDefinition[] = [
  { key: "skills", label: "Skills", icon: <BuildOutlined /> },
  { key: "specs", label: "Specs", icon: <FileTextOutlined /> },
  { key: "memory", label: "Memory", icon: <DatabaseOutlined /> },
  { key: "adr", label: "ADR", icon: <ApartmentOutlined /> },
  { key: "harness", label: "Harness", icon: <ExperimentOutlined /> },
  { key: "knowledge", label: "Knowledge", icon: <BookOutlined /> }
];

const improvementDefinitions: MetricDefinition[] = [
  { key: "skills", label: "Skills", icon: <BuildOutlined /> },
  { key: "specs", label: "Specs", icon: <FileTextOutlined /> },
  { key: "memory", label: "Memory", icon: <DatabaseOutlined /> },
  { key: "adr", label: "ADR", icon: <ApartmentOutlined /> },
  { key: "harness", label: "Harness", icon: <ExperimentOutlined /> },
  { key: "knowledge", label: "Knowledge", icon: <BookOutlined /> }
];

const pipelineOrder = [
  "Planner",
  "Spec",
  "Implement",
  "Review",
  "Harness",
  "Memory"
] as const;

const laneProgressMap: Record<string, number> = {
  ready: 10,
  running: 60,
  review: 80,
  qa: 90,
  done: 100
};

const motionEase = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: motionEase
    }
  }
};

async function fetchOrganizationStats() {
  return apiFetch<OrganizationStats>("/stats/organization");
}

async function fetchFeedbackStats() {
  return apiFetch<FeedbackStats>("/stats/feedback");
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function normalizeRatio(value: number | undefined) {
  if (!value) {
    return 0;
  }

  return clampPercentage(value <= 1 ? value * 100 : value);
}

function toConfidencePercent(value: number | undefined) {
  if (!value && value !== 0) {
    return 0;
  }

  return clampPercentage(value <= 1 ? value * 100 : value);
}

function resolvePipelineStatus(status?: string): "done" | "running" | "pending" {
  if (!status) {
    return "pending";
  }

  const normalized = status.toLowerCase();

  if (normalized === "done" || normalized === "complete" || normalized === "completed") {
    return "done";
  }

  if (normalized === "running" || normalized === "review" || normalized === "qa" || normalized === "active") {
    return "running";
  }

  return "pending";
}

function resolvePipelineMap(items: OrganizationStats["pipeline"]) {
  const mapped = new Map<string, "done" | "running" | "pending">();

  items?.forEach((item) => {
    mapped.set(item.stage.toLowerCase(), resolvePipelineStatus(item.status));
  });

  return pipelineOrder.map((stage) => ({
    stage,
    status: mapped.get(stage.toLowerCase()) ?? "pending"
  }));
}

function getLaneProgress(status: string) {
  return laneProgressMap[status.toLowerCase()] ?? 0;
}

function formatRefreshTime(timestamp: number) {
  if (!timestamp) {
    return "Just now";
  }

  return formatDateTime(new Date(timestamp).toISOString());
}

function DashboardSkeleton() {
  return (
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.spanTwo}`}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
      <div className={styles.card}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
      <div className={`${styles.card} ${styles.spanTwo}`}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
      <div className={styles.card}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
      <div className={styles.card}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
      <div className={`${styles.card} ${styles.spanTwo}`}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    </div>
  );
}

function RetryCard({
  title,
  description,
  onRetry,
  className
}: {
  title: string;
  description: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <EmptyState
        compact
        icon={<ReloadOutlined />}
        title={title}
        description={description}
        action={
          <Button type="primary" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.55 });
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    if (!inView) {
      return;
    }

    const controls = animate(previousValueRef.current, value, {
      duration: 0.9,
      ease: motionEase,
      onUpdate: (latest) => {
        setDisplayValue(Math.round(latest));
      },
      onComplete: () => {
        previousValueRef.current = value;
      }
    });

    return () => {
      controls.stop();
    };
  }, [inView, value]);

  return (
    <div ref={ref} className={styles.metricValue}>
      {displayValue.toLocaleString("zh-CN")}
    </div>
  );
}

function DashboardContent() {
  const organizationQuery = useQuery({
    queryKey: organizationKeys.stats,
    queryFn: fetchOrganizationStats
  });
  const feedbackQuery = useQuery({
    queryKey: feedbackKeys.stats,
    queryFn: fetchFeedbackStats
  });

  const organization = organizationQuery.data;
  const feedback = feedbackQuery.data;
  const latestUpdatedAt = Math.max(organizationQuery.dataUpdatedAt, feedbackQuery.dataUpdatedAt);
  const lanes = organization?.lanes ?? [];
  const pipelineItems = useMemo(() => resolvePipelineMap(organization?.pipeline), [organization?.pipeline]);
  const improvements = organization?.improvements ?? {};
  const improvementStats = improvementDefinitions.map((item) => ({
    ...item,
    value: Number(improvements[item.key as ImprovementKey] ?? 0)
  }));
  const hasImprovements = improvementStats.some((item) => item.value > 0);
  const assetStats = assetDefinitions.map((item) => ({
    ...item,
    value: Number(organization?.assets?.[item.key as AssetKey] ?? 0)
  }));
  const feedbackTotal = Number(feedback?.total ?? 0);
  const feedbackLike = Number(feedback?.like ?? 0);
  const feedbackDislike = Number(feedback?.dislike ?? 0);
  const feedbackRatio = normalizeRatio(feedback?.ratio ?? (feedbackTotal ? feedbackLike / feedbackTotal : 0));
  const feedbackByChannel = feedback?.byChannel ?? [];
  const feedbackByDay = feedback?.byDay ?? [];
  const maxByDayTotal = Math.max(1, ...feedbackByDay.map((item) => item.total));
  const today = dayjs().format("YYYY-MM-DD");
  const showSkeleton = (organizationQuery.isLoading && !organization) || (feedbackQuery.isLoading && !feedback);
  const organizationUnavailable = organizationQuery.isError && !organization;
  const feedbackUnavailable = feedbackQuery.isError && !feedback;
  const hasFeedbackData = feedbackTotal > 0;

  return (
    <WorkspacePageFrame
      title="Dashboard"
      description="View the AI organization, lane flow, knowledge-asset growth, and team feedback activity."
    >
      <motion.div initial="hidden" animate="visible" variants={containerVariants} className={styles.page}>
        <motion.section variants={cardVariants} className={`${styles.card} ${styles.heroCard}`}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroHeader}>
            <div>
              <Typography.Title level={3} className={styles.heroTitle}>
                AI Organization
              </Typography.Title>
              <Typography.Paragraph type="secondary" className={styles.heroDescription}>
                See role availability, lane progress, accumulated knowledge assets, and real user feedback at a glance.
              </Typography.Paragraph>
            </div>
            <Space size={12} wrap className={styles.heroActions}>
              <div className={styles.updatedAt}>
                <span className={styles.updatedLabel}>Updated</span>
                <strong>{formatRefreshTime(latestUpdatedAt)}</strong>
              </div>
              <Button
                icon={<ReloadOutlined />}
                loading={organizationQuery.isFetching || feedbackQuery.isFetching}
                onClick={() => {
                  void Promise.all([organizationQuery.refetch(), feedbackQuery.refetch()]);
                }}
              >
                Refresh
              </Button>
            </Space>
          </div>
        </motion.section>

        {showSkeleton ? (
          <motion.section variants={cardVariants}>
            <DashboardSkeleton />
          </motion.section>
        ) : (
          <div className={styles.grid}>
            {organizationUnavailable ? (
              <motion.section variants={cardVariants} className={`${styles.spanThree} ${styles.cardShell}`}>
                <RetryCard
                  title="Failed to load organization dashboard"
                  description="Could not retrieve the latest AI organization data. Please retry."
                  onRetry={() => {
                    void organizationQuery.refetch();
                  }}
                />
              </motion.section>
            ) : (
              <>
                <motion.section variants={cardVariants} className={`${styles.card} ${styles.spanTwo}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <Typography.Title level={5}>Agents</Typography.Title>
                      <Typography.Text type="secondary">All six core roles are online, each covering its own responsibilities.</Typography.Text>
                    </div>
                    <Tag color="success">6 / 6 Online</Tag>
                  </div>
                  <div className={styles.agentGrid}>
                    {roleItems.map((item) => (
                      <div key={item.key} className={styles.agentItem}>
                        <div className={styles.agentMeta}>
                          <span className={styles.onlineDot} aria-hidden="true" />
                          <Typography.Text strong>{item.label}</Typography.Text>
                        </div>
                        <Typography.Text type="secondary">{item.detail}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </motion.section>

                <motion.section variants={cardVariants} className={styles.card}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <Typography.Title level={5}>Pipeline</Typography.Title>
                      <Typography.Text type="secondary">Vertical flow indicators from Planner to Memory.</Typography.Text>
                    </div>
                  </div>
                  <div className={styles.pipelineList}>
                    {pipelineItems.map((item, index) => (
                      <div key={item.stage} className={styles.pipelineItem}>
                        <div className={styles.pipelineRail}>
                          <span
                            className={`${styles.pipelineDot} ${
                              item.status === "done"
                                ? styles.pipelineDotDone
                                : item.status === "running"
                                  ? styles.pipelineDotRunning
                                  : styles.pipelineDotPending
                            }`}
                          >
                            {item.status === "done" ? (
                              <CheckCircleFilled />
                            ) : item.status === "running" ? (
                              <ClockCircleOutlined />
                            ) : (
                              <span className={styles.pipelineDotInner}>○</span>
                            )}
                          </span>
                          {index < pipelineItems.length - 1 ? <span className={styles.pipelineLine} aria-hidden="true" /> : null}
                        </div>
                        <div className={styles.pipelineCopy}>
                          <Typography.Text strong>{item.stage}</Typography.Text>
                          <Typography.Text type="secondary">
                            {item.status === "done" ? "Done" : item.status === "running" ? "In progress" : "Pending"}
                          </Typography.Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>

                <motion.section variants={cardVariants} className={`${styles.card} ${styles.spanTwo}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <Typography.Title level={5}>Running Lanes</Typography.Title>
                      <Typography.Text type="secondary">Map progress by status and show each lane’s confidence.</Typography.Text>
                    </div>
                  </div>
                  {lanes.length ? (
                    <div className={styles.laneList}>
                      {lanes.map((lane) => {
                        const progress = getLaneProgress(lane.status);
                        const confidence = toConfidencePercent(lane.confidence);

                        return (
                          <div key={lane.id} className={styles.laneItem}>
                            <div className={styles.laneHeader}>
                              <div className={styles.laneTitleGroup}>
                                <Typography.Text strong>{lane.title}</Typography.Text>
                                {lane.agent ? <Tag bordered={false} color="blue">{lane.agent}</Tag> : null}
                                <Tag bordered={false} className={styles.statusTag}>
                                  {lane.status}
                                </Tag>
                              </div>
                              <Typography.Text className={styles.confidenceTag}>{confidence}% confidence</Typography.Text>
                            </div>
                            <div className={styles.progressTrack} aria-hidden="true">
                              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      icon={<ToolOutlined />}
                      title="No lanes are currently in progress"
                      description="Active lanes from the registry will appear here with their progress and confidence."
                    />
                  )}
                </motion.section>

                <motion.section variants={cardVariants} className={styles.card}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <Typography.Title level={5}>Today&apos;s Improvements</Typography.Title>
                      <Typography.Text type="secondary">Knowledge-asset growth over the last 24 hours.</Typography.Text>
                    </div>
                  </div>
                  {hasImprovements ? (
                    <div className={styles.improvementList}>
                      {improvementStats
                        .filter((item) => item.value > 0)
                        .map((item) => (
                          <div key={item.key} className={styles.improvementItem}>
                            <span className={styles.metricIcon}>{item.icon}</span>
                            <div className={styles.improvementMeta}>
                              <Typography.Text strong>{item.label}</Typography.Text>
                              <Typography.Text type="secondary">Added today</Typography.Text>
                            </div>
                            <div className={styles.improvementDelta}>
                              <ArrowUpOutlined />
                              +{item.value}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.zeroState}>No changes today</div>
                  )}
                </motion.section>

                <motion.section variants={cardVariants} className={`${styles.card} ${styles.spanThree}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <Typography.Title level={5}>Assets</Typography.Title>
                      <Typography.Text type="secondary">Six core asset types produced by the AI-native workflow.</Typography.Text>
                    </div>
                  </div>
                  <div className={styles.assetGrid}>
                    {assetStats.map((item) => (
                      <div key={item.key} className={styles.assetCard}>
                        <span className={styles.metricIcon}>{item.icon}</span>
                        <AnimatedNumber value={item.value} />
                        <Typography.Text type="secondary">{item.label}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {feedbackUnavailable ? (
              <motion.section variants={cardVariants} className={`${styles.card} ${styles.spanThree}`}>
                <RetryCard
                  title="Failed to load feedback dashboard"
                  description="Could not retrieve the latest feedback summary. Please retry."
                  onRetry={() => {
                    void feedbackQuery.refetch();
                  }}
                />
              </motion.section>
            ) : (
              <motion.section variants={cardVariants} className={`${styles.card} ${styles.spanThree}`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <Typography.Title level={5}>Feedback</Typography.Title>
                    <Typography.Text type="secondary">See like rate, the seven-day trend, and channel activity in one view.</Typography.Text>
                  </div>
                </div>

                {hasFeedbackData ? (
                  <div className={styles.feedbackGrid}>
                    <div className={styles.feedbackSummary}>
                      <div className={styles.circleWrap}>
                        <Progress
                          type="circle"
                          percent={feedbackRatio}
                          size={144}
                          strokeColor={{ "0%": "#52c41a", "100%": "#73d13d" }}
                          trailColor="rgba(148, 163, 184, 0.18)"
                          format={() => `${Math.round(feedbackRatio)}%`}
                        />
                      </div>
                      <div className={styles.feedbackTotals}>
                        <div className={styles.totalBadge}>
                          <LikeOutlined />
                          <span>{feedbackLike} likes</span>
                        </div>
                        <div className={styles.totalBadge}>
                          <AuditOutlined />
                          <span>{feedbackDislike} dislikes</span>
                        </div>
                        <div className={styles.totalBadge}>
                          <SmileOutlined />
                          <span>{feedbackTotal} total feedback</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.chartCard}>
                      <div className={styles.chartHeader}>
                        <Typography.Text strong>Last 7 days</Typography.Text>
                        <Typography.Text type="secondary">Pure CSS bar chart</Typography.Text>
                      </div>
                      <div className={styles.dayChart}>
                        {feedbackByDay.map((item) => {
                          const barHeight = `${Math.max(12, (item.total / maxByDayTotal) * 100)}%`;
                          const likeHeight = `${item.total ? Math.max(8, (item.like / item.total) * 100) : 0}%`;
                          const isToday = dayjs(item.date).format("YYYY-MM-DD") === today;

                          return (
                            <div key={item.date} className={`${styles.dayColumn} ${isToday ? styles.dayColumnToday : ""}`}>
                              <Typography.Text className={styles.dayCount}>{item.total}</Typography.Text>
                              <div className={styles.dayBarFrame}>
                                <div className={styles.dayBarTotal} style={{ height: barHeight }}>
                                  <div className={styles.dayBarLike} style={{ height: likeHeight }} />
                                </div>
                              </div>
                              <Typography.Text type="secondary" className={styles.dayLabel}>
                                {dayjs(item.date).format("MM/DD")}
                              </Typography.Text>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.channelCard}>
                      <div className={styles.chartHeader}>
                        <Typography.Text strong>Top Channels</Typography.Text>
                        <Typography.Text type="secondary">Sorted by total feedback</Typography.Text>
                      </div>
                      <div className={styles.channelList}>
                        {feedbackByChannel.slice(0, 5).map((item) => {
                          const ratio = item.total ? Math.round((item.like / item.total) * 100) : 0;

                          return (
                            <div key={item.channelId} className={styles.channelItem}>
                              <div className={styles.channelRow}>
                                <Typography.Text strong>{item.channelName || "Untitled channel"}</Typography.Text>
                                <Typography.Text type="secondary">{item.total} feedback items</Typography.Text>
                              </div>
                              <div className={styles.channelRow}>
                                <div className={styles.channelProgress} aria-hidden="true">
                                  <div className={styles.channelProgressFill} style={{ width: `${ratio}%` }} />
                                </div>
                                <Typography.Text className={styles.channelRatio}>{ratio}% like</Typography.Text>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={<RobotOutlined />}
                    title="No feedback yet"
                    description="No feedback yet. Like an AI response in chat to get started."
                  />
                )}
              </motion.section>
            )}
          </div>
        )}
      </motion.div>
    </WorkspacePageFrame>
  );
}

export function DashboardPage() {
  return <DashboardContent />;
}
