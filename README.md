# Wade AI Workspace

**AI-Native Workspace for Teams** — a spec-driven AIOS organization layer that turns a workspace into a living software factory: multi-role agents, layered memory, RAG knowledge, and team collaboration in one place.

[简体中文](./README_CN.md) · [Website](https://wadefengx.github.io/wade-ai-workspace/) · [Docs](./docs/architecture.md)

---

## ✨ Highlights

| Capability | What it does |
|---|---|
| 🧠 **Expert Agents** | Chat with AI out of the box — no `@AI` needed. Mention an expert (`@架构师`) to route to its persona. Agents carry emoji, role, description, and a configurable system prompt. |
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

## 🚀 Quick Start

```bash
cp .env.example .env
docker compose up --build
```

First boot initializes the MongoDB replica set, pushes the Prisma schema, seeds a demo workspace, and (optionally) pulls local Ollama models.

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/swagger

### Test accounts

| Account | Password | Role | Notes |
|---|---|---|---|
| admin@wade.local | admin | Global admin | Full access to every workspace |
| alice@wade.local | password123 | OWNER (Team Alpha) | Main demo account, seeded data |
| bob@wade.local | password123 | MEMBER (Team Alpha) | Permission-isolation demo |

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

```bash
npm install
npm run dev:web      # frontend :3000
npm run dev:api      # API :3001
npm run typecheck && npm run lint && npm test
```

## 🤝 Related

- [wade-ai](https://github.com/wadefengx/wade-ai) — knowledge base of AI collaboration practice (ponytail philosophy, AI-native dev system). Read it before driving AI on other projects.

## License

MIT
