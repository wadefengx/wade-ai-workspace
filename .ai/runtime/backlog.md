# Backlog

## 队列

| 队列 | 含义 | 进入条件 | 退出条件 |
|---|---|---|---|
| Backlog | 已记录未承诺 | Requirement/Story 已登记 | 拆清依赖与 owner 后进 `Ready` |
| Ready | 可拉起 | deps、验收、owner 齐全 | 开工进 `Running` |
| Running | 正在执行 | lane 已启动 | 提交产出进 `Review` |
| Blocked | 因依赖或冲突停滞 | 触发 blocked 规则 | 原因解除回原队列 |
| Review | 进入 review workflow | 自检材料齐全 | 通过进 `Done`,失败回 `Running` |
| Done | 完成交付 | review/QA 通过 | 上层 Epic/Story 归档后移出活跃看板 |

## 条目格式

| 字段 | 说明 |
|---|---|
| `epic` | 主题标识 |
| `story` | 可验收场景 |
| `task` | 交付面 |
| `lane` | 执行单元 |
| `status` | Backlog/Ready/Running/Blocked/Review/Done |
| `confidence` | 当前置信度 |
| `deps` | 直接依赖列表 |
| `owner` | 默认责任角色 |

## 维护规则

1. 看板按 `status` 分组维护,同组内按 `priority -> updated_at` 排序。
2. 一个 Task 可挂多个 Lane,但每个 Lane 只能出现在一个队列。
3. `Blocked` 条目必须写 `blocked_reason` 和 `next_check_at`。
4. `Done` 条目保留最近一次 `confidence` 与 `review_result` 供审计。

## 最小示例

| epic | story | task | lane | status | confidence | deps | owner |
|---|---|---|---|---|---|---|---|
| `epic-runtime-governance` | `story-planning-state-confidence` | `task-runtime-governance-docs` | `lane-runtime-docs-pm-architect` | `Running` | `0.82` | `[]` | `pm-architect` |

## Dashboard hooks

- 计数键: `backlog_count`, `ready_count`, `running_count`, `blocked_count`, `review_count`, `done_count`
- 维度键: `queue_count_by_owner`, `queue_count_by_epic`
