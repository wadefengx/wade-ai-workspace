---
name: ai-lane-workflow
description: Multi-lane parallel-development workflow: Hermes executes directly, divides lanes by domain, and feeds results back to memory after harness acceptance.
tags:
  - workflow
  - lane
  - sdd
---

# AI Lane Workflow (Multi-Lane Parallel Development)

## Triggers

- A phase requirement spans multiple domains (backend / frontend foundation / frontend pages / documentation / AIOS).
- The user requests "all-hands participation / parallel development".

## Process

1. **PM analysis**: write `specs/SPEC-phaseN.md`—goals, scope, non-goals, API contracts, acceptance criteria, and task decomposition.
2. **Split lanes**: divide by domain (backend / frontend foundation / frontend pages / Dashboard / AIOS docs); each lane exclusively owns a file group; designate one owner for files shared across lanes (navigation, layout, context); lock contracts first and avoid cross-lane integration while parallel.
3. **Execute**: each lane follows ponytail (smallest implementation / root-cause fix); pass lint/typecheck lane by lane.
4. **QA acceptance** (orchestrator): full lint + typecheck + test + build; execute harness regression scripts; verify browser behavior item by item (login/refresh restoration/navigation/forms/streaming/feedback/dark mode).
5. **Feed back**: write lessons/decisions to `.ai/memory/`; distill reusable practices into skills.
6. **Commit**: at feature granularity, `feat(scope): description`.

## Lane State Machine

`Draft → Ready → Running → Review → QA → Done → Merged`; Blocked (no progress across multiple rounds) → `Blocked`.

## Pitfalls

- After Prisma schema changes, dev-server hot reload is unreliable → run `prisma generate` manually and restart.
- Killing the npm wrapper can leave child processes holding the port → `lsof -ti :PORT | xargs kill -9`.
- Parallel lanes modifying the same file conflict → lock file ownership when splitting lanes.
