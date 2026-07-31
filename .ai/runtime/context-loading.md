# Context Loading Order

## Load from most global to most specific

1. Root `AGENTS.md` for mission, lifecycle, rules, and directory map.
2. `.ai/organization/` for team model, routing, and collaboration rules.
3. `.ai/registry/` to resolve the right workflow, skill, role, model, or tool path before scanning directories.
4. `.ai/runtime/` for model, prompt, tool, coding, pipeline, and context priorities.
5. Relevant `.ai/specs/` or legacy `specs/` documents for current scope.
6. Relevant `.ai/skills/` or legacy `skills/` documents for proven execution patterns.
7. `.ai/memory/` for project facts, decisions, conventions, and known issues.
8. `.ai/architecture/` and `.ai/knowledge/` for deeper reference when needed.
9. `.ai/harness/` for evals, regressions, fixtures, prompts, and scorecards.

## Loading principles

- Prefer the smallest context slice that can complete the task safely.
- When sources conflict, newer spec beats older narrative and runtime beats habit.
- Load old `specs/` and `skills/` paths only for compatibility or migration overlap.
- Do not pull in entire trees when one file answers the question.

## Refresh triggers

- Reload spec when scope changes.
- Reload memory when touching long-lived conventions or known issues.
- Reload harness before adding or modifying regression checks.
