# Prompt Policy

## Prompt shape

| Part | Expectation |
|---|---|
| Goal | One explicit outcome, not a vague theme |
| Scope | Paths, modules, and forbidden areas |
| Constraints | Contracts, style, and validation rules |
| Acceptance | Observable outputs or commands |
| Context refs | Exact spec, skill, or memory files |

## Policy

1. Use self-contained prompts for sub-agents and lane handoffs.
2. Quote only the minimum source needed; prefer file paths over pasted prose.
3. State non-goals explicitly when parallel lanes exist.
4. Avoid hidden assumptions about contracts, data, or permissions.
5. Ask the model to operate, not to brainstorm, unless discovery is the task.

## Anti-patterns

- Unbounded "improve this" prompts.
- Missing paths for multi-file edits.
- Validation requests with no runnable or observable target.
