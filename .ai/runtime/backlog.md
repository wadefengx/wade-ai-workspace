# Backlog

## Queues

| Queues | Meaning | Entry condition | Exit condition |
|---|---|---|---|
| Backlog | Recorded but not committed | Requirement/Story registered | Move to `Ready` once dependencies and the owner are clear |
| Ready | Ready to start | Dependencies, acceptance criteria, and owner are complete | Move to `Running` when work starts |
| Running | In progress | Lane has started | Move to `Review` when deliverables are submitted |
| Blocked | Stalled by a dependency or conflict | Blocked rule triggered | Return to the original queue when the cause is resolved |
| Review | Enter the review workflow | Self-review evidence is complete | Move to `Done` on pass; return to `Running` on failure |
| Done | Delivery completed | Review/QA passed | Remove from the active board when the parent Epic/Story is archived |

## Item format

| Field | Description |
|---|---|
| `epic` | Theme identifier |
| `story` | Acceptable scenario |
| `task` | Delivery surface |
| `lane` | Execution unit |
| `status` | Backlog/Ready/Running/Blocked/Review/Done |
| `confidence` | Current confidence |
| `deps` | Direct dependency list |
| `owner` | Default responsible role |

## Maintenance rules

1. Maintain the board grouped by `status`; sort each group by `priority -> updated_at`.
2. A Task may have multiple Lanes, but each Lane may appear in only one queue.
3. A `Blocked` item must include `blocked_reason` and `next_check_at`.
4. A `Done` item retains its latest `confidence` and `review_result` for auditing.

## Minimal example

| epic | story | task | lane | status | confidence | deps | owner |
|---|---|---|---|---|---|---|---|
| `epic-runtime-governance` | `story-planning-state-confidence` | `task-runtime-governance-docs` | `lane-runtime-docs-pm-architect` | `Running` | `0.82` | `[]` | `pm-architect` |

## Dashboard hooks

- Count keys: `backlog_count`, `ready_count`, `running_count`, `blocked_count`, `review_count`, `done_count`
- Dimension keys: `queue_count_by_owner`, `queue_count_by_epic`
