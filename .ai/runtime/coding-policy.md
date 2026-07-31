# Coding Policy

## Baseline

1. Spec first, then the smallest correct change.
2. Reuse existing helpers, contracts, and patterns before adding code.
3. Fix shared root causes instead of patching one caller at a time.
4. Preserve error visibility; do not hide failures behind broad catches.
5. Keep type safety and contract clarity intact.

## Repository-specific rules

- Keep API errors in Chinese when the product already surfaces Chinese UX copy.
- Preserve list and pagination response shapes already documented in specs.
- Avoid touching app code when the task is documentation or structure only.
- Update direct docs alongside behavior or process changes.

## Validation

- Run the smallest existing lint, typecheck, test, or file check that proves the task.
- Prefer boring diffs over clever abstractions.
- Leave one simple proof behind when logic becomes non-trivial.
