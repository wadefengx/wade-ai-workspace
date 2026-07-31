# Harness Overview

## Purpose

The harness tree stores artifacts that prove behavior, reproduce failures, or measure quality without cluttering app code.

## Buckets

| Path | Use |
|---|---|
| `evals/` | Scenario-based evaluation definitions |
| `fixtures/` | Reusable input or sample data |
| `benchmark/` | Performance or cost comparison notes |
| `regression/` | Repro assets for fixed bugs |
| `prompts/` | Reusable prompt templates for agent tasks |
| `scorecards/` | PASS/FAIL rubrics and review forms |
| `feature-login/` | Workflow-scoped harness sample with golden case and eval definition |

## Notes

- 每个重要 workflow 配一个 harness 目录,把 golden case、eval 定义和回归材料放在一起。
- Hermes 实现后优先跑 harness 出分,再把分数写回评审或发布材料。
- Keep `/tmp/verify-phase6.sh` referenced here until or unless it is promoted into version control.
- Prefer lightweight, source-controlled artifacts over opaque external tooling state.
