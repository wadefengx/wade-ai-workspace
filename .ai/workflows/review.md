# Review Workflow

## Input

- Lane Output, related spec, change path, current confidence, dependency State.

## Flow

| Stage | Action | Output |
|---|---|---|
| Self Review | Self-check against spec, Task, and Lane boundaries | Gap list or pass conclusion |
| Harness | Run minimal existing verification and log Result | Pass/fail evidence |
| Confidence Gate | Recalculate score using `runtime/confidence.md` | `review_confidence` / `release_confidence` |
| Memory Update | Record durable facts, decisions, and lessons | Memory increment |
| Merge Decision | Combine State, confidence, and dependencies to make decisions about whether to retain or leave | `merge`, `rework`, `escalate` |

## Self review checklist

1. Check whether the Output completely covers the Story/Task.
2. Did it change the correct shared seam rather than patch a single path?
3. Whether the document, index, state, and dependencies are updated synchronously.
4. Are there unexplained degradations, skips, or known risks?

## Decision rules

| Condition | Result |
|---|---|
| Harness fails | Return to `Running` to fix |
| confidence `< 0.70` | Escalate to Architect Review |
| confidence `< 0.50` | Add external review |
| Memory not updated | Must not enter merge |
| Dependency lane unfinished | Remain `Done` but do not merge |

## Output

- `review_result`, `confidence`, `memory_refs`, `merge_decision`, `follow_up_actions`

## Notes

- Review is a workflow, not a chat thread; all conclusions must fall to State, score, evidence or memory.
- If the lane only outputs documents, self-test, confidence record and memory update must still be performed.
