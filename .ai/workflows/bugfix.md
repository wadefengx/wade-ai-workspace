# Bugfix Workflow

## Input

- Reported symptom, reproduction steps, affected files, and any failing checks.

## Execution

1. Reproduce or trace the failure to the shared root cause.
2. Search sibling callers before patching the reported path.
3. Prefer one fix in the shared entrypoint over repeated local guards.
4. Keep the diff narrow and avoid unrelated cleanup.
5. Update docs or known issues if the bug changes durable guidance.

## Output

- Root-cause fix, regression coverage when warranted, and failure summary.

## Validation

- Run the smallest existing check or repro that fails without the fix.

## Memory and skill

- Record the cause in lessons or known issues if it is likely to recur.
