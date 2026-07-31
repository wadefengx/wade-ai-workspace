# Memory to Skill

## 晋升链路

| 阶段 | 触发条件 | 必要产出 |
|---|---|---|
| Feature/Change | lane 完成并进入 review | review 证据 |
| Lesson | 出现可复用做法、坑点或判定规则 | 1 条 lesson |
| Memory | lesson 已验证且影响未来选择 | memory 记录 |
| Skill Candidate | 同类模式至少重复 2 次 | 候选技能草案 |
| Architect Review | 检查适用范围、前置条件、失败边界 | 通过/打回 |
| Promote Skill | 写入 `.ai/skills/` 并登记 registry | 正式 skill |

## Lesson 记录要求

1. 只记录会改变未来执行选择的事实、决策或套路。
2. lesson 必须带 `source_lane`、`impact_scope`、`evidence_ref`。
3. 单次偶发技巧不晋升 skill,先留在 memory 观察。

## Candidate 格式

| 字段 | 说明 |
|---|---|
| `candidate_id` | 候选标识 |
| `source_memory_refs` | 来源 memory 列表 |
| `repeat_count` | 重复出现次数,至少 2 |
| `guardrails` | 适用边界与失败条件 |
| `owner` | 默认维护角色 |

## Promote 规则

1. Architect Review 通过前,候选只留在 memory/registry 注记,不进入正式 skills。
2. Promote 时同步更新 `.ai/skills/` 文档和 `.ai/registry/skills.yaml`。
3. 若后续 2 次以上被证明不适用,降级回 memory 并撤销 registry 入口。

## Dashboard hooks

- 计数键: `lesson_count`, `skill_candidate_count`, `promoted_skill_count`
- 追踪键: `candidate_conversion_rate`, `memory_refs_per_skill`
