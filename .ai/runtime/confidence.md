# Confidence

## 评分维度

| 维度 | 分值范围 | 权重 | 评分准则 |
|---|---|---|---|
| 实现完整性 | 0.0-1.0 | 0.35 | 需求与验收覆盖比例,缺口越少越高 |
| 测试/验证覆盖 | 0.0-1.0 | 0.30 | 现有测试、脚本、人工验证证据是否覆盖变更面 |
| API/契约符合度 | 0.0-1.0 | 0.25 | DTO、response shape、文档契约是否一致 |
| 依赖健康度 | 0.0-1.0 | 0.10 | 前置 lane、外部条件、回滚路径是否清晰 |

## 计算规则

- `confidence = completeness*0.35 + validation*0.30 + contract*0.25 + dependency*0.10`
- 分值保留两位小数,由 lane owner 在 `Review` 后首次提交,`QA` 后可重算一次。
- 任何关键维度为 `0` 时,总分不得高于 `0.49`。

## 阈值策略

| 区间 | 处理动作 | 默认 owner |
|---|---|---|
| `>= 0.85` | 可直接进入 merge 决策 | lane owner |
| `0.70 - 0.84` | 正常 review + QA | lane owner + QA |
| `< 0.70` | 自动触发 Architect Review | Architect |
| `< 0.50` | Architect Review + 外部 review | Architect + 外部 reviewer |

## 触发点

1. Planner: 先给 `initial_confidence`,低于 `0.70` 说明拆分或依赖仍不稳。
2. Review: 提交 `review_confidence`,作为是否进入 QA 的门槛。
3. QA: 提交 `release_confidence`,作为 merge 决策输入。

## 记录字段

| 字段 | 含义 |
|---|---|
| `initial_confidence` | Planner 估计值 |
| `review_confidence` | 自检后估计值 |
| `release_confidence` | QA 后估计值 |
| `confidence_reason` | 降分理由,最多 3 条 |

## Dashboard hooks

- 计数键: `low_confidence_lane_count`, `external_review_count`
- 分布键: `confidence_histogram`, `confidence_by_owner`
