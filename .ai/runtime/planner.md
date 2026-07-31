# Runtime Planner

## 拆解梯子

| 层级 | 回答问题 | 最小输出 | 默认 owner | 拆分规则 |
|---|---|---|---|---|
| Requirement | 为什么做 | 目标、范围、非目标、验收 | PM | 一次只对应一个明确业务目标 |
| Epic | 要完成哪块能力 | 1 个可追踪主题 + 成功标准 | PM + Architect | 按业务结果拆,不按技术层拆 |
| Story | 用户或系统获得什么 | 1 个可演示场景 | PM | 每个 Story 必须可独立验收 |
| Task | 为 Story 交付什么变更 | 1 组同类产出 | Owner lane lead | 跨契约才拆多个 Task |
| Lane | 谁在什么时候做 | 1 个 agent 可执行边界 | Architect | 共享文件或共享契约才禁止并行 |

## 映射规则

1. Requirement 至少拆成 1 个 Epic,禁止直接从 Requirement 跳到 Lane。
2. Epic 至少拆成 1 个 Story; Story 必须写清验收句子。
3. Task 只描述一个共享交付面: UI、API、schema、docs、ops 其一或紧邻组合。
4. Lane = `task + owner + touched paths + deps + confidence target`。
5. 一个 Lane 最多对应一个主 owner; 需要双 owner 时先继续拆 Lane。
6. 若 Task 需要超过 3 个独立路径或 2 个以上角色,先回退补 Story/Task 拆分。

## 标识约定

| 对象 | 格式 | 示例 |
|---|---|---|
| Epic | `epic-<theme>` | `epic-runtime-governance` |
| Story | `story-<epic>-<goal>` | `story-runtime-review-gate` |
| Task | `task-<story>-<surface>` | `task-review-workflow-doc` |
| Lane | `lane-<task>-<owner>` | `lane-review-workflow-pm-architect` |

## 示例

| Requirement | Epic | Story | Task | Lane |
|---|---|---|---|---|
| 补齐组织层运行机制 | `epic-runtime-governance` | `story-planning-state-confidence` | `task-runtime-governance-docs` | `lane-runtime-docs-pm-architect` |
| 补齐组织层运行机制 | `epic-runtime-governance` | `story-review-and-learning-loop` | `task-review-memory-skill-docs` | `lane-review-learning-pm-architect` |

## Dashboard hooks

- 统计键: `epic_count`, `story_count`, `task_count`, `lane_count`
- 漏斗键: `requirement_id`, `epic_id`, `story_id`, `task_id`, `lane_id`
