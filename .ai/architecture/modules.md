# Module Map

## Primary modules

| Area | Main paths | Responsibility |
|---|---|---|
| Web app | `apps/web/src/app`, `components`, `stores` | Pages, navigation, state, and UX |
| API app | `apps/api/src/*` | Auth, workspace, chat, AI, docs, and shared guards |
| Specs and skills | `.ai/specs`, `.ai/skills`, legacy mirrors | Phase contracts and repeatable practices |
| Memory and knowledge | `.ai/memory`, `.ai/knowledge` | Durable project context |
| Harness | `.ai/harness` | Evals, fixtures, regressions, prompts, and scorecards |

## Module rules

1. Shared contracts should be documented before lanes branch.
2. Documentation modules are part of the runtime, not an afterthought.
3. Legacy `specs/` and `skills/` remain compatibility surfaces during migration.

## Pending map entries

- TODO: add a tighter module map for docs browsing once the `.ai/` path is fully live.
- TODO: add cross-links for agent-provider selection and memory ingestion flows.
