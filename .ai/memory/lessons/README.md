# Lessons Memory

## Reusable lessons

1. Keep contracts in specs before parallel lanes start to avoid merge thrash.
2. Prefer copy-based migration when other lanes still read the old path.
3. Short runtime docs work better when deep detail lives in focused files.
4. Root-cause fixes beat one-off caller patches, especially around shared flows.
5. Regression scripts should be as self-describing as possible and print PASS/FAIL summaries so they can be directly connected to the subsequent Hermes scoring flow.
6. With dev-server hot reload, killing the npm wrapper first can leave child processes holding the port; diagnose with `lsof -ti :PORT` and clean up the specific PID rather than using `pkill`/`killall`.

## Pending entries

- TODO: capture which regression scripts should become permanent release gates after more runs.
- TODO: record which harness checks proved most valuable in QA.
- TODO: note any migration friction between `.ai/` and legacy docs paths.
- TODO: add lessons from future release packaging work.

## Maintenance rule

- Move a lesson into skills when it becomes a repeatable execution pattern instead of a one-time observation.
- Drop lessons that are no longer useful after architecture or workflow changes.
