# Architecture Memory

## Current shape

- Frontend lives in `apps/web` on Next.js App Router.
- Backend lives in `apps/api` on NestJS with Prisma over MongoDB.
- AI chat flows through provider abstractions and server-side key handling.

## Durable facts

| Area | Memory |
|---|---|
| API prefix | `/api` |
| Auth style | Custom JWT guards, no passport |
| Persistence | MongoDB replica set, Prisma schema managed in repo |
| Docs model | AIOS `.ai/` plus legacy `specs/` and `skills/` compatibility |

## Pending memory slots

- TODO: map module boundaries after Phase 9 settles.
- TODO: add high-level request flow diagram summary.
- TODO: record shared extension points for docs and AI providers.
- TODO: record architecture debt worth tracking across phases.
