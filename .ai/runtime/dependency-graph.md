# Dependency Graph

## 声明格式

```yaml
lane:
  id: lane-web-workspace-frontend
  task: task-workspace-ui
  owner: frontend
  deps:
    - lane-api-workspace-backend
    - lane-auth-contract-architect
```

## 约定

| 字段 | 必填 | 含义 |
|---|---|---|
| `id` | Yes | 当前 lane 唯一标识 |
| `task` | Yes | 所属 Task |
| `owner` | Yes | 默认责任角色 |
| `deps` | No | 前置 lane 列表,只写直接依赖 |

## 等待语义

1. 任一 `deps` 未到 `Done` 或 `Merged`,当前 lane 不得从 `Ready` 进 `Running`。
2. 可并行的 lane 必须无共享写路径或已由 Architect 明确串行化。
3. 因依赖等待导致无进展时,队列状态写 `Blocked`,原因写 `waiting_on:<lane-id>`。
4. 依赖解除后,按原优先级回到 `Ready`,无需重建 lane。

## 执行顺序

| 规则 | 说明 |
|---|---|
| 拓扑顺序 | 先执行入度为 0 的 lane,完成后释放后继 |
| 最小波次 | 同一波只拉起互不依赖的 lane |
| 变更收敛 | 共享契约变更先跑 Architect 或 owner lane |

## 示例 DAG

| Lane | Deps | 结果 |
|---|---|---|
| `lane-auth-contract-architect` | `[]` | 先执行 |
| `lane-api-workspace-backend` | `[lane-auth-contract-architect]` | 等契约完成 |
| `lane-web-workspace-frontend` | `[lane-api-workspace-backend]` | 后端完成前保持 waiting |

## Dashboard hooks

- 结构键: `lane_dep_count`, `dag_depth`, `critical_path`
- 阻塞键: `waiting_lane_count`, `waiting_on_map`
