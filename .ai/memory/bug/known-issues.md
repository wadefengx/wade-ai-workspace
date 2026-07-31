# Known Issues Memory

## Current entries

| Status | Item | Note |
|---|---|---|
| Resolved in Phase 9 | Full-page refresh dropped login state | Refresh-token flow is the planned fix path for the original issue |
| Current reference | Swagger lives at `/api/swagger` | Keep docs references aligned with the moved endpoint |
| Watch | 本地回归脚本依赖预置演示数据 | `admin/admin` 与 `alice/bob/carol` 账号需要在本地种子数据中可用,否则 harness 需先补种子 |

## Watch list

- TODO: add any remaining rollout regressions only after they are reproduced by harness.
- TODO: record known docs-browser edge cases if dual-path lookup starts drifting between `.ai/` and legacy paths.
- TODO: record environment-specific local setup gaps only when reproducible.
- TODO: remove resolved items once memory and changelog capture them elsewhere.

## Maintenance rule

- Prefer status labels such as current, watch, or resolved so readers know whether action is still needed.
- Remove stale entries once the fix is durable and archived elsewhere.
