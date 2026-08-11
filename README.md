# Wade AI Workspace

**AI-Native Workspace for Teams** — a spec-driven AIOS organization layer that turns a workspace into a living software factory: multi-role agents, layered memory, RAG knowledge, and team collaboration in one place.

[Chinese documentation](./README_CN.md) · [Website](https://wadefengx.github.io/wade-ai-workspace/) · [Docs](./docs/architecture.md)

---

## ✨ Highlights

| Capability | What it does |
|---|---|
| 🧠 **Expert Agents** | Chat with AI out of the box — no `@AI` needed. Mention an expert by name to route to its persona. Agents carry emoji, role, description, and a configurable system prompt. |
| 🔌 **Any LLM Provider** | Bring your own API key (DeepSeek / OpenAI / Anthropic / any OpenAI-compatible endpoint) **or** point at a local model (Ollama). Per-workspace default agent, one-click provider presets, connection testing. |
| 📚 **RAG Knowledge** | Upload documents → recursive chunking (512-token, 15% overlap) → embeddings → vector search. Content-hash dedup skips re-chunking identical files. Answers cite their sources with `[^n]` footnotes. |
| 🗂️ **Layered Memory (L0→L3)** | Conversation → atomic facts → scenarios → persona, distilled by LLM in a single structured pass. Progressive disclosure: personas and scenes guide recall, atoms drill down on demand. Inspired by TencentDB Agent Memory. |
| 👥 **Team & RBAC** | Workspaces, channels, members, global admin vs workspace roles (OWNER > ADMIN > MEMBER). |
| 📊 **Dashboards** | AI Organization dashboard, feedback dashboard, specs & skills browsing. |

## 🏗️ Tech Stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 · React 18 · TypeScript · Ant Design X · styled-components |
| Backend | NestJS · Prisma · MongoDB (replica set) |
| AI | OpenAI-compatible provider abstraction · Anthropic · Ollama (optional local) · EmbeddingService (API + local fallback) |
| Infra | Docker Compose · Swagger (`/api/swagger`) |

## 📚 Documentation & API

- [Swagger UI (live local API)](http://localhost:3001/api/swagger) — interactive OpenAPI documentation; public API base path: `/api`.
- [API contracts](./docs/api-contracts.md) — endpoints, authentication, streaming, and error responses.
- [Architecture](./docs/architecture.md) — system boundaries, topology, AI flow, and memory pipeline.
- [Database design](./docs/database.md) — MongoDB models, data relationships, and schema workflow.

## 🚀 Quick Start

### Prerequisites

Choose one development mode:

- **Docker Compose:** Docker Desktop with Docker Compose v2.
- **Host development:** Node.js 22+ and npm 10+, plus Docker Desktop for MongoDB.

Do not commit `.env` or `apps/api/.env`; both contain machine-specific secrets.

### Docker Compose configuration

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET; keep MONGO_DATABASE=wade_workspace to retain existing local data.
docker compose up --build
```

| `.env` variable | Configure when | Effect |
|---|---|---|
| `JWT_SECRET` | Always replace outside throwaway local development | Signs API sessions; changing it logs out existing sessions. |
| `MONGO_DATABASE` | Only to deliberately create/select another database | Changing it makes the app look empty because it selects a different database. |
| `WEB_PORT`, `API_PORT`, `MONGO_PORT` | A default host port is occupied | Changes host port mappings only; does not reset data. |
| `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL` | You need different local models | Models Compose downloads on first boot. |
| `MAX_UPLOAD_SIZE_MB` | You need another upload limit | API upload limit in MB. |

`apps/api/.env` is **not used by Docker Compose**. It is only for host development (`npm run dev:api`).

First boot initializes the MongoDB replica set, pushes the Prisma schema, seeds a demo workspace, and (optionally) pulls local Ollama models.

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/swagger

### Test accounts

| Account | Password | Role | Notes |
|---|---|---|---|
| admin@wade.local | admin | Global admin | Full access to every workspace |

`demo@wade.local` is created as the demo workspace owner but is not a login account.

### Data persistence

Docker stores MongoDB data in the named volume `ai-workspace_mongodb_data`. `docker compose down` preserves it; `docker compose down -v` deletes it and resets local data.

### Common commands

```bash
docker compose down            # stop, keep data
docker compose logs -f api web # follow logs
docker compose down -v         # reset everything (destructive)
docker compose exec api npm run prisma:push   # apply schema
docker compose exec api npm run prisma:seed   # reseed demo data
```

## 🧠 Using AI

1. **Pick an LLM**: open **Agents** → pick a preset (DeepSeek/OpenAI fill baseUrl + model for you) → paste an API key → **Test connection**. Or choose Ollama for a local model.
2. **Set the workspace default**: in Workspace settings, choose which agent replies by default.
3. **Chat**: just type. The workspace agent answers. `@expert` routes to that expert; knowledge-base hits are cited with `[^n]`.
4. **Upload knowledge**: **Knowledge** page → upload docs → auto-chunked + embedded. Re-uploading the same file is skipped via content hash.
5. **Watch memory grow**: after enough messages, trigger **extract** (or it runs automatically) — the channel's conversation is distilled into L1 atomic memories, L2 scenarios, and L3 persona in the **Memory** page.

## 🗂️ Monorepo Layout

```text
apps/
  web/    Next.js 16 frontend (App Router, AntD X, styled-components)
  api/    NestJS API (Prisma + MongoDB, AI providers, RAG, memory pipeline)
specs/    SDD specs — every phase has a SPEC before code (Phase 6 → 16)
docs/     architecture & API contract notes
infra/    docker-compose, container init
skills/   AI collaboration skills (Runtime Operating Model v2)
```

## 🧭 Project History (Spec-Driven)

Every phase is spec-first: `specs/SPEC-phaseNN-*.md` was written and approved **before** implementation.

- **Phase 6-13** — team workspaces, channels, AI streaming, knowledge RAG, RBAC, dashboards, UX/perf overhaul (first-screen JS 1.8MB → 598KB)
- **Phase 14** — expert agents (emoji/role/description, presets), default AI chat without `@AI`, `#` prefix removal
- **Phase 15** — LLM provider-ization: EmbeddingService (API + local fallback), content-hash dedup, recursive chunking, Ollama decoupling
- **Phase 16** — layered memory L0→L3 (TencentDB-style), per-workspace default agent, RAG citations, one-click provider presets

## 🧑‍💻 Development

### Host development

Host mode runs only the API and web processes; MongoDB must be running separately. It uses the same Docker MongoDB volume as Compose when the database port is `27017`.

```bash
npm install
cp apps/api/.env.example apps/api/.env

docker compose up -d mongodb  # start MongoDB and preserve ai-workspace_mongodb_data
npm run dev:api               # API :3001
npm run dev:web               # web :3000
```

The host API reads `apps/api/.env` (copied from `apps/api/.env.example`):

- `DATABASE_URL` must target `127.0.0.1:27017/wade_workspace` and keep `replicaSet=rs0&directConnection=true`.
- `JWT_SECRET` signs local API sessions; set any private development value.

`directConnection=true` is required because the Docker replica set advertises `mongodb:27017`, which the host cannot resolve.

### Full Docker stack

```bash
cp .env.example .env
docker compose up --build
```

Compose starts MongoDB, Ollama, API, and web together. Both modes access the same data only when host mode connects to the Compose MongoDB above.

### Quality checks

Run checks from the repository root:

```bash
npm run typecheck && npm run lint && npm test
npm run build
```

| Command | Purpose |
|---|---|
| `npm run dev:web` | Start the Next.js web app on port 3000. |
| `npm run dev:api` | Start the NestJS API on port 3001. |
| `npm run db:push` | Push the Prisma schema and regenerate the client. |
| `npm run db:seed` | Upsert the demo data without clearing existing records. |
| `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` | Validate all workspaces. |

### Troubleshooting

| Symptom | Check | Resolution |
|---|---|---|
| The web app is empty or requests fail | `curl http://localhost:3001/api/health` | Start MongoDB and the API. A healthy API returns `{"status":"ok"}`. |
| Host API cannot connect to MongoDB | Check `apps/api/.env` | Use `127.0.0.1:27017` and keep `replicaSet=rs0&directConnection=true`. |
| Existing data seems missing | Check `MONGO_DATABASE` | Restore `wade_workspace`; a different name selects a different database. |
| Port already in use | Check `WEB_PORT`, `API_PORT`, or `MONGO_PORT` | Change the affected host mapping in `.env`, then restart Compose. |
| AI replies fail | Open **Agents** and test the selected agent | Configure a working provider endpoint and API key, or run Ollama for a local agent. |

## 🤝 Related

- [wade-ai](https://github.com/wadefengx/wade-ai) — knowledge base of AI collaboration practice (ponytail philosophy, AI-native dev system). Read it before driving AI on other projects.

## License

MIT
