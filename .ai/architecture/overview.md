# Architecture Overview

## System summary

The repository is a local-first monorepo where web, API, AI runtime, and durable project context live together.

## Major layers

| Layer | Responsibility |
|---|---|
| Web | User interface, client state, and workspace flows |
| API | Auth, workspace, chat, AI orchestration, docs, and persistence |
| Data | MongoDB replica set accessed through Prisma |
| AIOS | `.ai/` docs, memory, skills, workflows, and harness |

## Design goals

1. Keep local setup runnable with minimal external dependency drift.
2. Preserve explicit contracts between lanes and modules.
3. Treat documentation, runtime policy, and knowledge as first-class assets.
4. Prefer small, evolvable seams over speculative architecture.
