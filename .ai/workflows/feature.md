# Feature Workflow

## Input

- Approved request, relevant phase spec, affected paths, and acceptance criteria.

## Execution

1. Confirm scope, non-goals, and dependencies in the active spec.
2. Check whether architecture or contract decisions are already documented.
3. Split work by lane only where shared files and contracts allow it.
4. Implement the smallest end-to-end change that satisfies the spec.
5. Update adjacent docs when the feature changes process or durable behavior.

## Output

- Working change, updated docs, and a concise implementation summary.

## Validation

- Run the smallest existing checks that prove the new behavior.

## Memory and skill

- Add durable facts to memory and extract a skill only if the pattern should repeat.
