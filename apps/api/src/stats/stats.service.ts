import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { load } from "js-yaml";
import { hasGlobalAdminRole } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";

type LaneStatus = "ready" | "running" | "review" | "qa" | "done" | "blocked";
type PipelineStatus = "pending" | "running" | "done";

type AssetStats = {
  specs: number;
  skills: number;
  memory: number;
  adr: number;
  harness: number;
  knowledge: number;
};

type LaneStats = {
  id: string;
  title: string;
  status: LaneStatus;
  confidence: number;
  agent?: string;
};

type PipelineStage = {
  stage: string;
  status: PipelineStatus;
};

type ImprovementStats = {
  skills: number;
  adr: number;
  memory: number;
  harness: number;
  specs: number;
};

type LaneRegistry = {
  lanes: LaneStats[];
  pipeline: PipelineStage[];
};

type FeedbackDay = {
  date: string;
  total: number;
  like: number;
};

type AggregateDayResult = {
  _id?: unknown;
  total?: unknown;
  like?: unknown;
};

const DEFAULT_LANE_TITLES: Record<string, string> = {
  A: "Backend API",
  B: "Frontend",
  C: "UI",
  D: "AIOS & Docs",
  E: "Architecture",
  F: "QA & Harness"
};

const DEFAULT_PIPELINE_STAGES = ["Planner", "Spec", "Implement", "Review", "Harness", "Memory"];
const FEEDBACK_TYPES = ["like", "dislike"] as const;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationStats(userId: string, userRole: UserRole) {
    await this.ensureStatsAccess(userId, userRole);

    const repoRoot = this.findRepositoryRootSafe();
    const registry = repoRoot ? this.loadLaneRegistry(repoRoot) : this.createDefaultLaneRegistry();

    return {
      assets: repoRoot ? this.countAssets(repoRoot) : this.createZeroAssets(),
      lanes: registry.lanes,
      pipeline: registry.pipeline,
      improvements: repoRoot ? this.countImprovements(repoRoot) : this.createZeroImprovements()
    };
  }

  async getFeedbackStats(userId: string, userRole: UserRole) {
    await this.ensureStatsAccess(userId, userRole);

    const totals = await this.prisma.message.groupBy({
      by: ["feedback"],
      where: {
        feedback: {
          in: [...FEEDBACK_TYPES]
        }
      },
      _count: {
        _all: true
      }
    });
    const like = totals.find((item) => item.feedback === "like")?._count._all ?? 0;
    const dislike = totals.find((item) => item.feedback === "dislike")?._count._all ?? 0;
    const total = like + dislike;
    const byChannelGroups = await this.prisma.message.groupBy({
      by: ["channelId", "feedback"],
      where: {
        feedback: {
          in: [...FEEDBACK_TYPES]
        }
      },
      _count: {
        _all: true
      }
    });
    const channelIds = [...new Set(byChannelGroups.map((item) => item.channelId))];
    const channels = channelIds.length === 0
      ? []
      : await this.prisma.channel.findMany({
          where: {
            id: {
              in: channelIds
            }
          },
          select: {
            id: true,
            name: true
          }
        });
    const channelNameById = new Map(channels.map((channel) => [channel.id, channel.name]));
    const byChannelMap = new Map<string, {
      channelId: string;
      channelName: string;
      total: number;
      like: number;
    }>();

    for (const item of byChannelGroups) {
      const existing = byChannelMap.get(item.channelId) ?? {
        channelId: item.channelId,
        channelName: channelNameById.get(item.channelId) ?? "",
        total: 0,
        like: 0
      };

      existing.total += item._count._all;

      if (item.feedback === "like") {
        existing.like += item._count._all;
      }

      byChannelMap.set(item.channelId, existing);
    }

    const byDayRaw = await this.prisma.message.aggregateRaw({
      pipeline: [{
        $match: {
          feedback: {
            $in: [...FEEDBACK_TYPES]
          },
          createdAt: {
            $gte: {
              $date: this.getFeedbackWindowStart().toISOString()
            }
          }
        }
      }, {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          total: {
            $sum: 1
          },
          like: {
            $sum: {
              $cond: [{
                $eq: ["$feedback", "like"]
              }, 1, 0]
            }
          }
        }
      }, {
        $sort: {
          _id: 1
        }
      }]
    });

    return {
      total,
      like,
      dislike,
      ratio: total === 0 ? 0 : Number((like / total).toFixed(2)),
      byChannel: [...byChannelMap.values()].sort((left, right) => {
        if (right.total !== left.total) {
          return right.total - left.total;
        }

        return right.like - left.like;
      }),
      byDay: this.normalizeFeedbackDays(byDayRaw)
    };
  }

  private async ensureStatsAccess(userId: string, userRole: UserRole) {
    if (hasGlobalAdminRole(userRole)) {
      return;
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        userId
      },
      select: {
        id: true
      }
    });

    if (!membership) {
      throw new ForbiddenException("无权访问组织统计");
    }
  }

  private countAssets(repoRoot: string) {
    const aiRoot = join(repoRoot, ".ai");

    return {
      specs: this.safeCountMarkdownFiles(join(aiRoot, "specs")),
      skills: this.safeCountMarkdownFiles(join(aiRoot, "skills")),
      memory: this.safeCountMarkdownFiles(join(aiRoot, "memory")),
      adr: this.safeCountMarkdownFiles(join(aiRoot, "architecture", "adr")),
      harness: this.safeCountMarkdownFiles(join(aiRoot, "harness")),
      knowledge: this.safeCountMarkdownFiles(join(aiRoot, "knowledge"))
    };
  }

  private loadLaneRegistry(repoRoot: string): LaneRegistry {
    const registryPath = join(repoRoot, ".ai", "registry", "lanes.yaml");

    try {
      if (!existsSync(registryPath)) {
        return this.createDefaultLaneRegistry(repoRoot);
      }

      const parsed = load(readFileSync(registryPath, "utf8"));
      const lanes = this.normalizeLanes(this.extractLanesSource(parsed));
      const pipeline = this.normalizePipeline(this.extractPipelineSource(parsed));

      return {
        lanes: lanes.length > 0 ? lanes : this.createDefaultLaneRegistry(repoRoot).lanes,
        pipeline: pipeline.length > 0 ? pipeline : this.derivePipeline(lanes)
      };
    } catch {
      return this.createDefaultLaneRegistry(repoRoot);
    }
  }

  private createDefaultLaneRegistry(repoRoot?: string): LaneRegistry {
    const lanes = repoRoot ? this.inferLanesFromGit(repoRoot) : [];
    const normalizedLanes = lanes.length > 0 ? lanes : this.createBuiltInDefaultLanes();

    return {
      lanes: normalizedLanes,
      pipeline: this.derivePipeline(normalizedLanes)
    };
  }

  private inferLanesFromGit(repoRoot: string) {
    try {
      const output = execSync("git --no-pager log -n 3 --pretty=%s", {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const seen = new Set<string>();
      const lanes: LaneStats[] = [];

      for (const line of output.split("\n")) {
        const match = line.match(/\blane\s+([a-z])\b/i);

        if (!match) {
          continue;
        }

        const id = match[1].toUpperCase();

        if (seen.has(id)) {
          continue;
        }

        seen.add(id);
        lanes.push({
          id,
          title: this.defaultLaneTitle(id),
          status: "done",
          confidence: 0.9
        });
      }

      return lanes;
    } catch {
      return [];
    }
  }

  private countImprovements(repoRoot: string) {
    try {
      const output = execSync('git --no-pager log --since="24 hours" --name-only --format=', {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const buckets = {
        skills: new Set<string>(),
        adr: new Set<string>(),
        memory: new Set<string>(),
        harness: new Set<string>(),
        specs: new Set<string>()
      };

      for (const rawLine of output.split("\n")) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        if (line.startsWith(".ai/skills/") || line.startsWith("skills/")) {
          buckets.skills.add(line);
          continue;
        }

        if (line.startsWith(".ai/architecture/adr/")) {
          buckets.adr.add(line);
          continue;
        }

        if (line.startsWith(".ai/memory/")) {
          buckets.memory.add(line);
          continue;
        }

        if (line.startsWith(".ai/harness/")) {
          buckets.harness.add(line);
          continue;
        }

        if (line.startsWith(".ai/specs/") || line.startsWith("specs/")) {
          buckets.specs.add(line);
        }
      }

      return {
        skills: buckets.skills.size,
        adr: buckets.adr.size,
        memory: buckets.memory.size,
        harness: buckets.harness.size,
        specs: buckets.specs.size
      };
    } catch {
      return this.createZeroImprovements();
    }
  }

  private normalizeFeedbackDays(raw: unknown): FeedbackDay[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.flatMap((item) => {
      const day = item as AggregateDayResult;
      const date = typeof day._id === "string" ? day._id : "";

      if (!date) {
        return [];
      }

      return [{
        date,
        total: this.toNumber(day.total),
        like: this.toNumber(day.like)
      }];
    });
  }

  private getFeedbackWindowStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 6);

    return date;
  }

  private extractLanesSource(parsed: unknown) {
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    const document = parsed as Record<string, unknown>;

    return document.lanes ?? document;
  }

  private extractPipelineSource(parsed: unknown) {
    if (!parsed || typeof parsed !== "object") {
      return [];
    }

    return (parsed as Record<string, unknown>).pipeline ?? [];
  }

  private normalizeLanes(source: unknown): LaneStats[] {
    if (Array.isArray(source)) {
      return source.flatMap((item) => this.normalizeLaneEntry(item));
    }

    if (!source || typeof source !== "object") {
      return [];
    }

    return Object.entries(source as Record<string, unknown>).flatMap(([id, value]) =>
      this.normalizeLaneEntry({
        id,
        ...(value && typeof value === "object" ? value : {})
      })
    );
  }

  private normalizeLaneEntry(source: unknown): LaneStats[] {
    if (!source || typeof source !== "object") {
      return [];
    }

    const lane = source as Record<string, unknown>;
    const id = typeof lane.id === "string" ? lane.id.trim().toUpperCase() : "";

    if (!id) {
      return [];
    }

    return [{
      id,
      title: typeof lane.title === "string" && lane.title.trim()
        ? lane.title.trim()
        : this.defaultLaneTitle(id),
      status: this.normalizeLaneStatus(lane.status),
      confidence: this.normalizeConfidence(lane.confidence),
      agent: typeof lane.agent === "string" && lane.agent.trim() ? lane.agent.trim() : undefined
    }];
  }

  private normalizePipeline(source: unknown): PipelineStage[] {
    if (!Array.isArray(source)) {
      return [];
    }

    return source.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const stage = typeof (item as Record<string, unknown>).stage === "string"
        ? (item as Record<string, unknown>).stage?.toString().trim()
        : "";

      if (!stage) {
        return [];
      }

      return [{
        stage,
        status: this.normalizePipelineStatus((item as Record<string, unknown>).status)
      }];
    });
  }

  private derivePipeline(lanes: LaneStats[]): PipelineStage[] {
    const hasLanes = lanes.length > 0;
    const allDone = hasLanes && lanes.every((lane) => lane.status === "done");
    const hasImplementationProgress = lanes.some((lane) =>
      ["running", "review", "qa", "done", "blocked"].includes(lane.status)
    );
    const hasReviewProgress = lanes.some((lane) =>
      ["review", "qa", "done", "blocked"].includes(lane.status)
    );
    const hasHarnessProgress = lanes.some((lane) => ["qa", "done"].includes(lane.status));

    return DEFAULT_PIPELINE_STAGES.map((stage) => {
      if (!hasLanes) {
        return {
          stage,
          status: "pending" as const
        };
      }

      if (stage === "Planner" || stage === "Spec") {
        return {
          stage,
          status: "done" as const
        };
      }

      if (stage === "Implement") {
        return {
          stage,
          status: allDone ? "done" : hasImplementationProgress ? "running" : "pending"
        };
      }

      if (stage === "Review") {
        return {
          stage,
          status: allDone ? "done" : hasReviewProgress ? "running" : "pending"
        };
      }

      if (stage === "Harness") {
        return {
          stage,
          status: allDone ? "done" : hasHarnessProgress ? "running" : "pending"
        };
      }

      return {
        stage,
        status: allDone ? "done" : "pending"
      };
    });
  }

  private normalizeLaneStatus(value: unknown): LaneStatus {
    if (typeof value !== "string") {
      return "done";
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "ready") {
      return "ready";
    }

    if (["running", "in_progress", "in-progress"].includes(normalized)) {
      return "running";
    }

    if (normalized === "review") {
      return "review";
    }

    if (normalized === "qa") {
      return "qa";
    }

    if (normalized === "blocked") {
      return "blocked";
    }

    return "done";
  }

  private normalizePipelineStatus(value: unknown): PipelineStatus {
    if (typeof value !== "string") {
      return "done";
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "pending") {
      return "pending";
    }

    if (["running", "in_progress", "in-progress"].includes(normalized)) {
      return "running";
    }

    return "done";
  }

  private normalizeConfidence(value: unknown) {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0.9;
    }

    return Number(numericValue.toFixed(2));
  }

  private defaultLaneTitle(id: string) {
    return DEFAULT_LANE_TITLES[id] ?? `Lane ${id}`;
  }

  private createBuiltInDefaultLanes(): LaneStats[] {
    return [
      { id: "A", title: this.defaultLaneTitle("A"), status: "done" as const, confidence: 0.96, agent: "BE" },
      { id: "B", title: this.defaultLaneTitle("B"), status: "done" as const, confidence: 0.9, agent: "FE" },
      { id: "C", title: this.defaultLaneTitle("C"), status: "done" as const, confidence: 0.88, agent: "UX/UI" },
      { id: "D", title: this.defaultLaneTitle("D"), status: "done" as const, confidence: 0.92, agent: "PM" },
      { id: "E", title: this.defaultLaneTitle("E"), status: "done" as const, confidence: 0.9, agent: "Architect" },
      { id: "F", title: this.defaultLaneTitle("F"), status: "done" as const, confidence: 0.95, agent: "QA" }
    ];
  }

  private createZeroAssets(): AssetStats {
    return {
      specs: 0,
      skills: 0,
      memory: 0,
      adr: 0,
      harness: 0,
      knowledge: 0
    };
  }

  private createZeroImprovements(): ImprovementStats {
    return {
      skills: 0,
      adr: 0,
      memory: 0,
      harness: 0,
      specs: 0
    };
  }

  private safeCountMarkdownFiles(directoryPath: string) {
    try {
      return this.countMarkdownFiles(directoryPath);
    } catch {
      return 0;
    }
  }

  private countMarkdownFiles(directoryPath: string): number {
    if (!existsSync(directoryPath)) {
      return 0;
    }

    const stats = statSync(directoryPath);

    if (!stats.isDirectory()) {
      return directoryPath.endsWith(".md") ? 1 : 0;
    }

    return readdirSync(directoryPath).reduce((total, entry) => {
      return total + this.countMarkdownFiles(join(directoryPath, entry));
    }, 0);
  }

  private findRepositoryRootSafe() {
    try {
      return this.findRepositoryRoot(process.cwd());
    } catch {
      return null;
    }
  }

  private findRepositoryRoot(startPath: string) {
    let currentPath = resolve(startPath);
    let fallbackPath: string | null = null;

    while (true) {
      if (existsSync(join(currentPath, "package.json"))) {
        fallbackPath = currentPath;

        if (existsSync(join(currentPath, ".ai"))) {
          return currentPath;
        }
      }

      const parentPath = dirname(currentPath);

      if (parentPath === currentPath) {
        if (fallbackPath) {
          return fallbackPath;
        }

        throw new Error("repository root not found");
      }

      currentPath = parentPath;
    }
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }

    if (value && typeof value === "object") {
      const rawValue = Object.values(value as Record<string, unknown>).find((item) =>
        typeof item === "string" || typeof item === "number"
      );

      return this.toNumber(rawValue);
    }

    return 0;
  }
}
