# Decision Memory

## Stable decisions

| Decision | Why it matters |
|---|---|
| Use AIOS `.ai/` as the organization layer | Keeps runtime context, specs, memory, and harness in one place |
| Keep legacy `specs/` and `skills/` readable during migration | Avoids breaking parallel lanes |
| Prefer local-first tooling and mirrors | Reduces external setup drift |
| Keep AGENTS entrypoint short | Forces detail into structured docs instead of one giant file |
| ADR-006: document planner/state/confidence/DAG/backlog/review/learning runtime hooks | Makes lane orchestration explicit and dashboard-ready without shipping app code |

## ADR log

| ADR | Decision | Scope | Status |
|---|---|---|---|
| ADR-006 | Elevate planner, lane states, confidence, dependency graph, backlog, review workflow, and memory-to-skill into first-class `.ai/` runtime docs | Organization/runtime governance | Accepted |

## Pending entries

- TODO: summarize Phase 9 auth refresh decision after Lane A lands.
- TODO: summarize docs service dual-path compatibility once merged.
- TODO: add decisions around workspace SPA navigation conventions.
- TODO: add decision about long-lived harness storage paths.

## Review cue

- Promote a decision here only when it changes future choices, not just one implementation detail.
