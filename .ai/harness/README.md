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

- The default target is `http://localhost:3001/api`; override it with `API_BASE=http://host:port/api` when needed.
- These scripts print a PASS/FAIL summary and signal the result with their exit code, making them suitable for local QA or a later Hermes pipeline.

## Notes

- Give every important workflow a harness directory and keep its golden cases, eval definitions, and regression assets together.
- After Hermes implements a change, run the harness first and then record its score in review or release material.
- Prefer lightweight, source-controlled artifacts over opaque external tooling state.
