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

## Regression scripts

| Script | Scope |
|---|---|
| `regression/verify-phase6.sh` | Phase 6 members / agents / users search / AI stream e2e |
| `regression/verify-phase9.sh` | Phase 9 auth smoke, channels `lastMessageAt`, docs browser specs listing |
| `regression/verify-phase10.sh` | Phase 10 workspace icon CRUD smoke |

## How to run

```bash
bash .ai/harness/regression/verify-phase6.sh
bash .ai/harness/regression/verify-phase9.sh
bash .ai/harness/regression/verify-phase10.sh
```

- 默认目标是 `http://localhost:3001/api`; 如需覆盖可设置 `API_BASE=http://host:port/api`.
- 这些脚本会输出 PASS/FAIL 汇总并用退出码表达结果,适合接到本地 QA 或后续 Hermes 流水线。

## Notes

- 每个重要 workflow 配一个 harness 目录,把 golden case、eval 定义和回归材料放在一起。
- Hermes 实现后优先跑 harness 出分,再把分数写回评审或发布材料。
- Prefer lightweight, source-controlled artifacts over opaque external tooling state.
