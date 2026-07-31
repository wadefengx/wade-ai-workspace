# Lessons Memory

## Reusable lessons

1. Keep contracts in specs before parallel lanes start to avoid merge thrash.
2. Prefer copy-based migration when other lanes still read the old path.
3. Short runtime docs work better when deep detail lives in focused files.
4. Root-cause fixes beat one-off caller patches, especially around shared flows.
5. 回归脚本要尽量自描述并输出 PASS/FAIL 汇总,这样才能直接接到后续 Hermes 打分链路。
6. dev server 热重载下若先杀 npm wrapper,子进程可能残留占用端口;排查时先 `lsof -ti :PORT` 再定点清理 PID,不要用 `pkill`/`killall`.

## Pending entries

- TODO: capture which regression scripts should become permanent release gates after more runs.
- TODO: record which harness checks proved most valuable in QA.
- TODO: note any migration friction between `.ai/` and legacy docs paths.
- TODO: add lessons from future release packaging work.

## Maintenance rule

- Move a lesson into skills when it becomes a repeatable execution pattern instead of a one-time observation.
- Drop lessons that are no longer useful after architecture or workflow changes.
