# Lessons Memory

## Reusable lessons

1. Keep contracts in specs before parallel lanes start to avoid merge thrash.
2. Prefer copy-based migration when other lanes still read the old path.
3. Short runtime docs work better when deep detail lives in focused files.
4. Root-cause fixes beat one-off caller patches, especially around shared flows.

## Pending entries

- TODO: capture the final Phase 9 rollout lesson set.
- TODO: record which harness checks proved most valuable in QA.
- TODO: note any migration friction between `.ai/` and legacy docs paths.
- TODO: add lessons from future release packaging work.

## Maintenance rule

- Move a lesson into skills when it becomes a repeatable execution pattern instead of a one-time observation.
- Drop lessons that are no longer useful after architecture or workflow changes.
