# Folder Structure

## Root layout

| Path | Purpose |
|---|---|
| `apps/web` | Next.js frontend |
| `apps/api` | NestJS backend |
| `.ai/organization` | Team model, routing, and role contracts |
| `.ai/runtime` | Context, prompt, tool, model, and coding policy |
| `.ai/workflows` | Repeatable task flows |
| `.ai/specs` | Templates, completed specs, and future active/archive buckets |
| `.ai/skills` | Reusable execution patterns by domain |
| `.ai/memory` | Durable project facts and issues |
| `.ai/knowledge` | Curated business, product, engineering, framework, and reference docs |
| `.ai/architecture` | System docs and ADRs |
| `.ai/harness` | Validation support assets |

## Notes

- Root `AGENTS.md` is the runtime entrypoint.
- Legacy `specs/` and `skills/` stay readable until cleanup is scheduled.
