# Memory to Skill

## Promotion path

| Stage | TriggersCondition | Required output |
|---|---|---|
| Feature/Change | Lane completed and entered review | Review evidence |
| Lesson | A reusable practice, pitfall, or decision rule emerges | One lesson |
| Memory | Lesson is verified and affects future choices | Memory record |
| Skill Candidate | Same pattern repeats at least twice | Candidate-skill draft |
| Architect Review | Check scope of applicability, prerequisites, and failure boundaries | Pass/return |
| Promote Skill | Write to `.ai/skills/` and register in the registry | Formal skill |

## Lesson recording requirements

1. Record only facts, decisions, or patterns that will change future execution choices.
2. A lesson must include `source_lane`, `impact_scope`, and `evidence_ref`.
3. Do not promote a one-off technique to a skill; retain it in memory for observation first.

## Candidate format

| Field | Description |
|---|---|
| `candidate_id` | Candidate identifier |
| `source_memory_refs` | Source memory list |
| `repeat_count` | Occurrence count, at least 2 |
| `guardrails` | Applicability boundaries and failure conditions |
| `owner` | Default maintenance role |

## Promotion Rules

1. Before Architect Review passes, candidates remain annotations in memory/registry and do not enter formal skills.
2. When promoting, update the `.ai/skills/` documentation and `.ai/registry/skills.yaml` together.
3. If later proven inapplicable more than twice, demote it to memory and remove its registry entry.

## Dashboard hooks

- Count keys: `lesson_count`, `skill_candidate_count`, `promoted_skill_count`
- Tracking keys: `candidate_conversion_rate`, `memory_refs_per_skill`
