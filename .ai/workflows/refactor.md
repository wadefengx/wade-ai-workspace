# Refactor Workflow

## Input

- Explicit refactor goal, protected behavior, and impacted modules.

## Execution

1. Restate the invariant behavior that must not change.
2. Find the smallest structural seam that improves the target area.
3. Reuse existing abstractions; delete duplication before adding wrappers.
4. Keep contracts stable unless the spec says otherwise.
5. Stage doc updates when folder, ownership, or architecture guidance shifts.

## Output

- Cleaner structure, preserved behavior, and updated architecture notes.

## Validation

- Run focused checks around the touched behavior and module boundaries.

## Memory and skill

- Capture the simplified pattern if it becomes a preferred repository idiom.
