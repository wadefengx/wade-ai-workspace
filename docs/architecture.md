# Architecture (Current)

## Boundaries

- **Frontend** (`apps/web`, Next.js 16 App Router): renders pages, manages session state, and calls the API; it does not access the database directly.
- **Backend API** (`apps/api`, NestJS): authentication, workspaces, channels, messages, agents, knowledge, and memory; the only client entry point for data.
- **Database**: MongoDB (replica set, Prisma ORM); stores users, workspaces, messages, agents, knowledge chunks, and layered memory.
- **AI layer**: provider abstraction (OpenAI-compatible / Anthropic / Ollama), agent engines, and `EmbeddingService`; all calls run through the API server and keys remain server-side.

## Topology

```text
Browser (Next.js :3000)
   │ HTTP / SSE
   ▼
API (NestJS :3001) ──► MongoDB (replica set)
   │
   ├─► OpenAI-compatible / Anthropic / Ollama (LLM, API key or local)
   └─► EmbeddingService (API embeddings + local fallback)
```

- Docker Compose orchestrates `web` / `api` / `mongodb` / optional `ollama`.
- The API depends on MongoDB health (since Phase 15, it **does not depend on Ollama**; the default agent is `OPENAI_COMPATIBLE`).
- Streaming chat uses SSE: `POST /channels/:id/ai/stream`; events include `token` / `citations` / `done` / `error` (Phase 16 answers include `[^n]` citations).

## AI Conversation Flow

1. The frontend POSTs a message → `chat.service` creates a `Message` (`PENDING`).
2. `streamAgentReply`: **`workspace.defaultAgentId`** takes priority; otherwise, `ensureDefaultAgent` creates/selects `OPENAI_COMPATIBLE`.
3. `default-chat.engine.buildPromptMessages`: retrieves `KnowledgeChunk` entries (embedding cosine similarity; degrades to empty context on failure) and injects layered memory (L3 persona + top-K L2 scenarios).
4. Provider stream → SSE `token` events → frontend rendering; the `citations` event carries the reference list.

## Memory Pipeline (Phase 16, TencentDB Agent Memory approach)

```text
Channel messages (L0)
   │ extractFromConversation (one LLM JSON extraction; automatic at ≥20 messages or manual)
   ▼
L1 atomic facts ──embedding cosine > 0.92 deduplication──► L2 scenario aggregation ──► L3 persona
   └── sourceMessageIds traceability chain (can drill down to original conversations)
```

- Extraction failures fully degrade and do not block chat.
- Progressive disclosure: the full persona (small) + top-K scenarios by relevance + atomic facts drilled down as needed.

## Directory Structure

```text
apps/
  web/    Next.js 16 frontend (App Router, AntD X, styled-components)
  api/    NestJS API (prisma/, ai/providers/, ai/engines/, knowledge/, memory/)
specs/    SDD specifications (Phases 6–16; specs first)
docs/     This directory (architecture / database / API contracts)
infra/    docker-compose and container initialization
website/  Project landing page (deployed with GitHub Pages)
```

## Evolution Principles

1. Spec-driven: write and approve `specs/SPEC-phaseNN-*.md` before implementing each phase.
2. API keys are write-only; embedding/RAG failures degrade instead of returning 500 errors.
3. Provider abstraction: LLMs can use an API key or run locally, and are switchable per workspace (AnythingLLM approach).
