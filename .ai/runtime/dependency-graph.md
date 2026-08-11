# Dependency Graph

## Declaration format

```yaml
lane:
  id: lane-web-workspace-frontend
  task: task-workspace-ui
  owner: frontend
  deps:
    - lane-api-workspace-backend
    - lane-auth-contract-architect
```

## Conventions

| Field | Required | Meaning |
|---|---|---|
| `id` | Yes | Unique identifier for the current lane |
| `task` | Yes | Parent Task |
| `owner` | Yes | Default responsible role |
| `deps` | No | Prerequisite lane list; include direct dependencies only |

## Waiting semantics

1. If any `deps` item has not reached `Done` or `Merged`, the current lane must not move from `Ready` to `Running`.
2. Parallel lanes must have no shared write paths, or the Architect must explicitly serialize them.
3. When there is no progress due to dependent waiting, the QueuesState is written as `Blocked` and the reason is written as `waiting_on:<lane-id>`.
4. When the dependency is resolved, return to `Ready` at the original priority; do not rebuild the lane.

## Execution order

| Rule | Description |
|---|---|
| Topological order | Run lanes with in-degree 0 first; completion releases their successors |
| Minimum wave | Start only mutually independent lanes in the same wave |
| Change convergence | Run the Architect or owner lane first for shared-contract changes |

## Example DAG

| Lane | Deps | Result |
|---|---|---|
| `lane-auth-contract-architect` | `[]` | Run first |
| `lane-api-workspace-backend` | `[lane-auth-contract-architect]` | Wait for contract completion |
| `lane-web-workspace-frontend` | `[lane-api-workspace-backend]` | Remain waiting until backend completion |

## Dashboard hooks

- Structure keys: `lane_dep_count`, `dag_depth`, `critical_path`
- Blocking keys: `waiting_lane_count`, `waiting_on_map`
