# Context Priority

## Resolution order

| Priority | Source | Use when |
|---|---|---|
| 1 | Active task request | Interpreting the current ask |
| 2 | Relevant phase spec | Defining scope and acceptance |
| 3 | Root `AGENTS.md` + `.ai/runtime/` | Applying repo-wide rules |
| 4 | `.ai/organization/` | Deciding ownership and routing |
| 5 | `.ai/memory/` | Reusing durable project knowledge |
| 6 | `.ai/skills/` | Reusing proven execution patterns |
| 7 | `.ai/architecture/` + `.ai/knowledge/` | Deep reference and background |
| 8 | Legacy `specs/` and `skills/` | Compatibility during migration |

## Tie-breakers

1. Newer explicit spec beats older notes.
2. Runtime policy beats personal preference.
3. Concrete code and contracts beat vague summaries.
4. Known issues matter only until a newer fix supersedes them.

## Use discipline

- Load only what materially changes the decision.
- Drop stale context once the task narrows.
- Record new durable truth in memory instead of re-explaining it next time.
