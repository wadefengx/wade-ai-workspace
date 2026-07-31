# Tech Stack

## Application stack

| Area | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16 + React 19 | App Router, workspace SPA flows |
| UI | Ant Design 6 + `@ant-design/x` | Shared UI patterns and chat-oriented components |
| State | Zustand + TanStack Query | Client state and data fetching |
| Backend | NestJS 11 | Modular API and service structure |
| Data | Prisma 6 + MongoDB | Replica set for local-first persistence |
| AI | OpenAI-compatible providers plus pluggable agents | Server-side key handling |

## Operational stack

- Docker Compose for the all-in-one local bootstrap path.
- Homebrew-hosted MongoDB and Ollama for native local validation.
- Mirror defaults: `npmmirror` and `gitclone`, with `quay.io` fallback when needed.

## Pending notes

- TODO: add exact package-manager and script entrypoints if they change from current defaults.
- TODO: record model-provider support deltas once the provider matrix stabilizes.
