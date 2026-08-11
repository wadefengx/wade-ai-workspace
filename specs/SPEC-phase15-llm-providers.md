---
name: SPEC-phase15-llm-providers
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 15: LLM Provider Support (API Key + Local) + RAG Deduplication

## Goal

User requests:
1. **Do not use Ollama as the only LLM:** support **API-key integration** (OpenAI-compatible/DeepSeek/Anthropic, etc.) alongside **local deployment** (Ollama). Do not assume every user has Ollama installed.
2. **Persist document RAG in the DB and avoid duplicate chunking:** deduplicate by content hash during document reindexing; skip unchanged content instead of repeating embedding/chunking.

## Current State (inspected)

**Already present (retain the good parts):**
- The Agent model supports `type: OLLAMA | OPENAI_COMPATIBLE | ANTHROPIC | OPENCLAW | HERMES` + `providerConfigRef(baseUrl/apiKey/model)`; the engine selects a provider by `type` ✅
- RAG foundation: `KnowledgeDocument` + `KnowledgeChunk(embedding Float[])`, `splitIntoChunks`, and cosine `searchSimilarChunks` ✅
- `default-chat.engine` already retrieves similar chunks and injects context in `buildPromptMessages` ✅
- The Agents page already has six presets (OpenAI/DeepSeek/Ollama/Claude/OpenClaw/Hermes) ✅

**Problems to change:**
1. **Embeddings are locked to Ollama:** `knowledge.service` and `default-chat.engine` directly call `ollamaService.embed()` — without Ollama, the whole RAG pipeline fails.
2. **Duplicate chunking:** reindexing unconditionally runs `deleteMany` plus a full rebuild, with no content-hash deduplication.
3. **The default Agent depends on Ollama:** the seed’s default Agent points to Ollama, so chat/RAG cannot work in an environment without it.
4. **`OPENAI_COMPATIBLE` is a shell:** API keys can be configured but are not verified; preset `baseUrl` values must be filled manually.

## Approach (referencing Dify/AnythingLLM/OpenWebUI + 2026 RAG benchmarks)

Research conclusions (selectively adopted):
- **AnythingLLM/Dify:** provider abstraction + write-only API keys in DB + Workspace-level model selection — the existing Agent system is already a foundation; only “do not lock the default to Ollama” is missing.
- **2026 RAG benchmark** (Firecrawl/Databricks/premai): recursive 512-token chunks with 10–20% overlap are generally optimal (69% accuracy); short documents (<200 tokens) should not be split; semantic/LLM chunking costs 14–50× more and is not cost-effective; **chunk quality > embedding model**.
- **Deduplication:** a content hash (sha256) is standard in Dify/AnythingLLM — skip reindexing identical content to prevent repeated chunking.

### Task 1: Embedding Provider Abstraction (core)

Create `EmbeddingService` (or extend `ollama.service`) to support two embedding sources and route by Agent configuration:

```ts
// src/ai/embedding.service.ts
// - OLLAMA: GET {OLLAMA_BASE_URL}/api/embed (move existing logic here)
// - OPENAI_COMPATIBLE: POST {baseUrl}/embeddings (OpenAI-compatible protocol; works for DeepSeek/SiliconFlow/OpenAI)
// Selection: prioritize embedding configuration in Agent.providerConfig;
//            otherwise fall back to env OLLAMA_BASE_URL (compatibility with deployed environments);
//            if neither exists, gracefully degrade RAG (skip embedding/retrieval and return empty context, never 500).
```

- `knowledge.service.ts`: inject `EmbeddingService` and replace `ollamaService.embed`.
- `default-chat.engine.ts`: inject `EmbeddingService` and replace `ollamaService.embed` in `buildPromptMessages`.
- Add optional Agent embedding fields: `embeddingModel` / `embeddingBaseUrl`; when empty, use the chat-model source or default.
- On RAG embedding failure: **log a warning and return empty context**; normal chat continues uninterrupted.

### Task 2: Document Deduplication + Improved Chunking

**Deduplication (core):**
- Add `contentHash String?` to `KnowledgeDocument`.
- Reindex flow: extract text → `sha256(content)` → find a READY document with the same hash in the same Workspace:
  - **Exists → return immediately** (skip chunking/embedding; status remains READY; do not duplicate records).
  - **Does not exist → perform normal chunking + embedding + insert**, recording `contentHash`.
- Existing-chunk update logic: only `deleteMany` and rebuild when the hash changes; return immediately if it is identical.

**Improved chunking (2026 benchmark):**
- Change `splitIntoChunks` to **recursive chunking**: paragraphs (`\n\n`) first, then lines (`\n`), sentences (`。.！？!?`), then character fallback; default chunk size is **approximately 512 tokens / 1,500 characters** (Chinese is about one character per token; conservatively 800–1,000 characters) with **15% overlap** (about 120–150 characters).
- Do **not split** short documents (<200 tokens, approximately 600 characters); embed the whole document as one chunk.
- Preserve the existing exported `splitIntoChunks` signature for test compatibility; change only internal strategy.

### Task 3: Remove Ollama Dependency from the Default Agent

- Seed default Agent: use `OPENAI_COMPATIBLE` with empty `baseUrl` (the user supplies a DeepSeek/OpenAI key on the first Agents-page visit); **do not default to Ollama**.
- `docker-compose`: retain the `ollama` service, but remove mandatory Ollama dependency from API/web `depends_on` (a failed Ollama model pull must not block the API). Retain `OLLAMA_*` env variables as the “local deployment” option.
- When no provider is configured for chat: return a friendly error (“Configure an LLM API Key on the Agents page first”), not a 500.

### Task 4: Strengthen Agents-page UI

- Validate the format when presets fill `baseUrl`; retain the existing API-key hint “written only; never displayed”.
- Label the Ollama preset “requires Ollama running locally”; label DeepSeek/OpenAI presets “requires API Key”.
- Add a collapsible optional embedding-configuration section to the Agent form; by default it follows the chat provider.

## Acceptance

- [ ] Without Ollama (API key only): chat through DeepSeek/OpenAI works; document upload → chunking → RAG retrieval works using API embeddings.
- [ ] With Ollama: existing behavior does not regress.
- [ ] Re-uploading/reindexing the same document skips chunking on the second run (DB chunk count does not grow redundantly).
- [ ] If embedding fails: chat degrades without interruption and logs a warning.
- [ ] The default Agent does not depend on Ollama; `docker compose` works without Ollama once a key is provided.
- [ ] `npm run lint && typecheck && build` all pass; API unit tests pass (80+).
- [ ] Browser acceptance: configure a key on Agents → chat → upload a document → ask about its content → answer cites the document.

## Non-goals

- Do not migrate to a vector database (MongoDB cosine similarity is sufficient at MVP scale).
- Do not encrypt multi-tenant API keys (`apiKey` already writes only and never reads back; sufficient for now).
- Do not make real OPENCLAW/HERMES harness calls (Phase 16).
