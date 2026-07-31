# Task Routing Rules

## Route by task type

| Task type | Primary owner | Required partners | Typical trigger |
|---|---|---|---|
| New feature | PM | Architect, Frontend, Backend, QA | New capability in a spec |
| Bugfix | PM | Affected lane owner, QA | Broken behavior or regression |
| Refactor | Architect | Affected lane owner, QA | Structural cleanup without scope change |
| Release prep | PM | QA, DevOps | Phase completion or cut |
| Architecture decision | Architect | PM, affected lanes | Contract, runtime, or platform change |
| Research spike | PM or Architect | Target lane | Unclear feasibility or tradeoff |

## Routing heuristics

1. Start from the smallest owner set that can finish the task safely.
2. Route contract changes through Architect before implementation lanes diverge.
3. Route user-visible behavior through UX when copy or interaction changes.
4. Route persistence, auth, and API behavior through Backend even if UI reports the issue.
5. Route acceptance and regression questions through QA, not back to implementation by default.
6. Route environment, scripts, and harness upkeep through DevOps.

## Escalation

- If a task touches multiple shared entrypoints, PM coordinates sequencing.
- If ownership is ambiguous after one pass, Architect decides the lane split.
- If the spec is missing, PM creates or updates it before work continues.
