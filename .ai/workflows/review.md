# Review Workflow

## Input

- Lane 产出、相关 spec、变更路径、当前 confidence、依赖状态。

## Flow

| 阶段 | 动作 | 产出 |
|---|---|---|
| Self Review | 对照 spec、Task、Lane 边界做自检 | 缺口清单或通过结论 |
| Harness | 运行最小现有验证并记录结果 | 通过/失败证据 |
| Confidence Gate | 依据 `runtime/confidence.md` 重算分值 | `review_confidence` / `release_confidence` |
| Memory Update | 记录 durable facts、decision、lesson | memory 增量 |
| Merge Decision | 结合状态、confidence、依赖做去留判断 | `merge`, `rework`, `escalate` |

## Self review checklist

1. 产出是否完整覆盖 Story/Task 验收。
2. 是否改到了正确共享接缝而不是单一路径补丁。
3. 文档、索引、状态、依赖是否同步更新。
4. 是否存在未解释的降级、跳过或已知风险。

## Decision rules

| 条件 | 结果 |
|---|---|
| harness 失败 | 回 `Running` 修复 |
| confidence `< 0.70` | 升级 Architect Review |
| confidence `< 0.50` | 增加外部 review |
| memory 未更新 | 不得进入 merge |
| 依赖 lane 未完成 | 保持 `Done` 但不 merge |

## Output

- `review_result`, `confidence`, `memory_refs`, `merge_decision`, `follow_up_actions`

## Notes

- Review 是 workflow,不是聊天线程; 所有结论必须落到状态、分值、证据或 memory。
- 若 lane 仅产出文档,仍要执行自检、confidence 记录和 memory 更新。
