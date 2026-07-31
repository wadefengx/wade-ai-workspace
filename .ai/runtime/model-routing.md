# Model Routing

## Default routing

| Work shape | Preferred model behavior | Notes |
|---|---|---|
| Repo docs or file surgery | Fast coding model | Keep context narrow and edits surgical |
| Multi-file reasoning | Higher-capability model | Use when contracts or tradeoffs matter |
| Search-heavy research | Research-capable model | Verify claims with source files |
| Long spec digestion | Long-context variant | Prefer document-first synthesis |
| Repetitive validation | Fast, lower-cost model | Escalate only on unclear failures |

## Selection rules

1. Start with the cheapest model that can safely finish the task.
2. Upgrade when context window, reasoning depth, or synthesis quality becomes the bottleneck.
3. Do not spend a large model on work that a direct file edit can finish.
4. Prefer deterministic, source-backed output over speculative verbosity.

## Escalation triggers

- Cross-cutting architecture changes.
- Ambiguous failures after one grounded pass.
- Research tasks that require synthesis across many documents.
