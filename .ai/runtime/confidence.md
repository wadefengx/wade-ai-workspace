# Confidence

## Scoring dimensions

| Dimension | Score range | Weight | Scoring criteria |
|---|---|---|---|
| Implementation completeness | 0.0-1.0 | 0.35 | Share of requirements and acceptance criteria covered; fewer gaps score higher |
| Test/validation coverage | 0.0-1.0 | 0.30 | Whether existing tests, scripts, and manual-validation evidence cover the changed surface |
| API/contract conformance | 0.0-1.0 | 0.25 | Whether DTOs, response shapes, and documented contracts are consistent |
| Dependency health | 0.0-1.0 | 0.10 | Whether prerequisite lanes, external conditions, and rollback paths are clear |

## Calculation rules

- `confidence = completeness*0.35 + validation*0.30 + contract*0.25 + dependency*0.10`
- Keep two decimal places; the lane owner first submits after `Review` and may recalculate once after `QA`.
- When any key Dimension is `0`, the total score cannot be higher than `0.49`.

## Threshold policy

| Range | Action | Default owner |
|---|---|---|
| `>= 0.85` | May proceed directly to a merge decision | lane owner |
| `0.70 - 0.84` | Normal review + QA | lane owner + QA |
| `< 0.70` | Automatically trigger Architect Review | Architect |
| `< 0.50` | Architect Review + external review | Architect + external reviewer |

## Trigger points

1. Planner: Give `initial_confidence` first, lower than `0.70` Description split or dependency is still unstable.
2. Review: Submit `review_confidence` as the gate for entering QA.
3. QA: Submit `release_confidence` as merge decision input.

## Recorded fields

| Field | Meaning |
|---|---|
| `initial_confidence` | Planner estimate |
| `review_confidence` | Estimate after self-review |
| `release_confidence` | Estimate after QA |
| `confidence_reason` | Reasons for a score reduction, at most 3 |

## Dashboard hooks

- Count keys: `low_confidence_lane_count`, `external_review_count`
- Distribution keys: `confidence_histogram`, `confidence_by_owner`
