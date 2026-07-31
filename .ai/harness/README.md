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

## Notes

- Keep `/tmp/verify-phase6.sh` referenced here until or unless it is promoted into version control.
- Prefer lightweight, source-controlled artifacts over opaque external tooling state.
