# Tool Policy

## Preferred order

1. Read known files directly.
2. Use glob to find candidate files by name.
3. Use ripgrep to find precise text matches.
4. Use shell commands only when file tools are insufficient.
5. Use sub-agents only for genuinely separate, context-heavy work.

## Usage rules

- Batch independent reads in parallel.
- Keep searches inside the repository root unless the task requires otherwise.
- Prefer copy-safe, non-destructive commands.
- Do not use background agents unless there is real parallel work to do.
- Validate with the smallest existing command that covers the change.

## Guardrails

- No destructive git resets or hidden rewrites.
- No silent fallback when a command fails with a meaningful error.
- No new dependencies unless the task or failure forces it.
