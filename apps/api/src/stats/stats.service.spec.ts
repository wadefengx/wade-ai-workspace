import * as childProcess from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserRole } from "@prisma/client";
import { StatsService } from "./stats.service";

describe("StatsService", () => {
  const prisma = {
    workspaceMember: {
      findFirst: jest.fn()
    },
    message: {
      groupBy: jest.fn(),
      aggregateRaw: jest.fn()
    },
    channel: {
      findMany: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("counts markdown assets from the .ai workspace", async () => {
    const fixtureRoot = createFixtureWorkspace({
      ".ai/specs/one.md": "# spec",
      ".ai/specs/two.md": "# spec",
      ".ai/skills/common.md": "# skill",
      ".ai/memory/project.md": "# memory",
      ".ai/architecture/adr/ADR-001.md": "# adr",
      ".ai/harness/README.md": "# harness",
      ".ai/knowledge/product.md": "# knowledge"
    });
    const nestedCwd = join(fixtureRoot, "apps", "api");
    mkdirSync(nestedCwd, { recursive: true });
    writeFileSync(join(nestedCwd, "package.json"), "{}");
    jest.spyOn(process, "cwd").mockReturnValue(nestedCwd);
    jest.spyOn(childProcess, "execSync").mockImplementation((command) => {
      if (String(command).includes("--since=")) {
        return "";
      }

      return "";
    });
    const service = new StatsService(prisma as never);

    await expect(service.getOrganizationStats("admin-1", UserRole.ADMIN)).resolves.toMatchObject({
      assets: {
        specs: 2,
        skills: 1,
        memory: 1,
        adr: 1,
        harness: 1,
        knowledge: 1
      }
    });

    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("falls back to inferred lanes when lanes.yaml is missing", async () => {
    const fixtureRoot = createFixtureWorkspace({
      ".ai/specs/one.md": "# spec"
    });
    jest.spyOn(process, "cwd").mockReturnValue(fixtureRoot);
    jest.spyOn(childProcess, "execSync").mockImplementation((command) => {
      if (String(command).includes("--pretty=%s")) {
        return "Phase 11 Lane A: backend\nPhase 11 Lane B: frontend\nPhase 11 Lane C: ui\n";
      }

      return "";
    });
    const service = new StatsService(prisma as never);

    await expect(service.getOrganizationStats("admin-1", UserRole.ADMIN)).resolves.toMatchObject({
      lanes: [{
        id: "A",
        title: "Backend API",
        status: "done",
        confidence: 0.9
      }, {
        id: "B",
        title: "Frontend",
        status: "done",
        confidence: 0.9
      }, {
        id: "C",
        title: "UI",
        status: "done",
        confidence: 0.9
      }]
    });

    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("aggregates feedback totals, channels, and daily trend", async () => {
    prisma.message.groupBy
      .mockResolvedValueOnce([{
        feedback: "like",
        _count: {
          _all: 3
        }
      }, {
        feedback: "dislike",
        _count: {
          _all: 1
        }
      }])
      .mockResolvedValueOnce([{
        channelId: "channel-1",
        feedback: "like",
        _count: {
          _all: 2
        }
      }, {
        channelId: "channel-1",
        feedback: "dislike",
        _count: {
          _all: 1
        }
      }, {
        channelId: "channel-2",
        feedback: "like",
        _count: {
          _all: 1
        }
      }]);
    prisma.channel.findMany.mockResolvedValue([{
      id: "channel-1",
      name: "General"
    }, {
      id: "channel-2",
      name: "Random"
    }]);
    prisma.message.aggregateRaw.mockResolvedValue([{
      _id: "2026-08-01",
      total: 2,
      like: 1
    }, {
      _id: "2026-08-02",
      total: 2,
      like: 2
    }]);
    const service = new StatsService(prisma as never);

    await expect(service.getFeedbackStats("admin-1", UserRole.ADMIN)).resolves.toEqual({
      total: 4,
      like: 3,
      dislike: 1,
      ratio: 0.75,
      byChannel: [{
        channelId: "channel-1",
        channelName: "General",
        total: 3,
        like: 2
      }, {
        channelId: "channel-2",
        channelName: "Random",
        total: 1,
        like: 1
      }],
      byDay: [{
        date: "2026-08-01",
        total: 2,
        like: 1
      }, {
        date: "2026-08-02",
        total: 2,
        like: 2
      }]
    });
  });

  it("blocks workspace members from global organization and feedback dashboards", async () => {
    prisma.workspaceMember.findFirst.mockResolvedValue({ id: "member-1" });
    const service = new StatsService(prisma as never);

    await expect(service.getOrganizationStats("user-1", UserRole.USER)).rejects.toThrow(
      "You do not have access to organization statistics"
    );
    await expect(service.getFeedbackStats("user-1", UserRole.USER)).rejects.toThrow(
      "You do not have access to organization statistics"
    );

    expect(prisma.message.groupBy).not.toHaveBeenCalled();
    expect(prisma.message.aggregateRaw).not.toHaveBeenCalled();
  });
});

function createFixtureWorkspace(files: Record<string, string>) {
  const rootPath = mkdtempSync(join(tmpdir(), "stats-service-"));

  writeFileSync(join(rootPath, "package.json"), "{}");

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(rootPath, relativePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }

  return rootPath;
}
