# Runtime Planner

## Decomposition ladder

| Level | Question answered | Minimum output | Default owner | Decomposition rule |
|---|---|---|---|---|
| Requirement | Why do it | Goal, scope, non-goals, acceptance | PM | Each maps to only one clear business goal |
| Epic | Which capability must be completed | One traceable theme + success criteria | PM + Architect | Decompose by business outcome, not technical layer |
| Story | What the user or system gains | One demonstrable scenario | PM | Each Story must be independently acceptable |
| Task | What change is delivered for the Story | One group of homogeneous deliverables | Owner lane lead | Split into multiple Tasks only across contracts |
| Lane | Who does it and when | One agent-executable boundary | Architect | Only shared files or shared contracts prohibit parallelism |

## Mapping Rules

1. Decompose each Requirement into at least one Epic; do not jump directly from Requirement to Lane.
2. Decompose each Epic into at least one Story; every Story must state an acceptance sentence.
3. A Task describes only one shared delivery surface: UI, API, schema, docs, ops, or a closely related combination.
4. Lane = `task + owner + touched paths + deps + confidence target`.
5. A Lane has at most one primary owner; if two owners are required, decompose the Lane further first.
6. If a Task needs more than 3 independent paths or more than 2 roles, step back and further decompose Story/Task.

## Identifier Conventions

| Object | Format | Example |
|---|---|---|
| Epic | `epic-<theme>` | `epic-runtime-governance` |
| Story | `story-<epic>-<goal>` | `story-runtime-review-gate` |
| Task | `task-<story>-<surface>` | `task-review-workflow-doc` |
| Lane | `lane-<task>-<owner>` | `lane-review-workflow-pm-architect` |

## Example

| Requirement | Epic | Story | Task | Lane |
|---|---|---|---|---|
| Complete organization-layer operating mechanisms | `epic-runtime-governance` | `story-planning-state-confidence` | `task-runtime-governance-docs` | `lane-runtime-docs-pm-architect` |
| Complete organization-layer operating mechanisms | `epic-runtime-governance` | `story-review-and-learning-loop` | `task-review-memory-skill-docs` | `lane-review-learning-pm-architect` |

## Dashboard hooks

- Statistic keys: `epic_count`, `story_count`, `task_count`, `lane_count`
- Funnel keys: `requirement_id`, `epic_id`, `story_id`, `task_id`, `lane_id`
