---
name: SPEC-phase16-memory-llm
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 16: Memory Hierarchy (L0–L3) + Workspace-level LLM + RAG Citations + One-click Provider Setup

## Goal

Four primary tracks (all confirmed by the user) plus implementation of TencentDB-Agent-Memory ideas:

1. **Workspace-level LLM selection** (AnythingLLM): every Workspace can choose its own default Agent/model.
2. **One-click Provider setup** (Dify): DeepSeek/OpenAI/local presets fill `baseUrl`; users only enter the key.
3. **Inline RAG citations** (Open WebUI): AI replies identify their knowledge-chunk sources.
4. **L0–L3 memory hierarchy** (the core TencentDB-Agent-Memory idea): conversation → atomic facts → scenarios → user profile, with progressive disclosure replacing a flat memory table.
5. **Symbolic memory (optional, Phase 17):** long-conversation tool logs → external files + Mermaid summaries. This phase implements only the data model and extraction pipeline; L2/L3 visualization panels are deferred.

## Current State (inspected)

- Memory model: flat table (`workspaceId` / `userId` / `type` / `content` / `confidence` / `enabled`) — **not hierarchical**.
- Agents already have `providerConfig(baseUrl/apiKey/model)` + six presets; Workspace has no `defaultAgentId`.
- RAG: `KnowledgeChunk` plus cosine retrieval are used in chat, but replies **do not mark citation sources**.
- `EmbeddingService` (Phase 15): API + local fallback is complete.

## Tasks

### Task 1: L0–L3 Memory Hierarchy (core idea)

**Refactor the `Memory` schema:**

```prisma
model Memory {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  workspaceId String   @db.ObjectId
  userId      String?  @db.ObjectId
  level       MemoryLevel  // L0_CONVERSATION | L1_ATOM | L2_SCENARIO | L3_PERSONA
  type        MemoryType   // FACT | PREFERENCE | DECISION | LESSON | ...
  content     String       // L0: original conversation; L1: atomic fact; L2: scenario description; L3: profile entry
  sourceMessageIds String[]?  // Provenance chain (drill-down)
  parentMemoryId  String?     // L2 parent is L3; L1 parent is L2 (hierarchical relation)
  confidence  Float?
  priority    Int?      @default(0)
  enabled     Boolean   @default(true)
  createdBy   String    @db.ObjectId
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([workspaceId, level])
  @@index([workspaceId, userId, level])
}
```

**Extraction pipeline (`memory.service.ts`):**
- `extractFromConversation(channelId)`: take the channel’s most recent N messages → make a single LLM call (JSON mode, using a TencentDB-inspired scene-segmentation prompt) → return scenario segments + L1 atomic facts (including `type` / `priority` / `sourceMessageIds`).
- **L1 deduplication:** within the same Workspace, if content is semantically similar (embedding cosine > 0.92 or identical `sourceMessageIds`) → skip it (batch-dedup approach).
- **L2 scenarios:** the LLM aggregates L1 facts belonging to the same scenario into scenario blocks (summary + associated L1 ID list).
- **L3 profile:** the LLM derives user preferences/habits from L2 (for example, “User prefers Markdown documents” and “User dislikes UI placeholders”) and stores them as persona entries.
- **Trigger:** when a channel reaches a message threshold (such as 20) or when manually triggered; failures degrade gracefully and do not block chat.
- **Retrieval:** inject during chat — L3 profile (all, small) + L2 scenarios (relevance topK) + L1 atoms (drill down on demand), with progressive disclosure.

**Compatibility:** migrate old Memory data to `L1_ATOM` (default level), and group existing Memory-page display by `level`.

### Task 2: Workspace-level LLM Selection (AnythingLLM)

- Add `defaultAgentId String?` to Workspace (relation to Agent).
- Workspace creation/settings form: select a default Agent from the Workspace’s Agents.
- `chat.service streamAgentReply`: prioritize `workspace.defaultAgentId`; otherwise fall back to existing `ensureDefaultAgent`.
- Frontend: display the current default Agent (emoji + name) beside the Workspace selector and allow quick switching.

### Task 3: Inline RAG Citations (Open WebUI)

- After `default-chat.engine` retrieves chunks, inject chunk sources (filename + `chunkIndex`) as **citation markers** in the prompt and require the LLM to output `[^n]` superscripts at citations.
- Message rendering: recognize `[^n]` → render a clickable citation superscript → clicking opens a Popover with the original chunk text + source document.
- Add a “References” list at the end of the answer (document name + click to open the Knowledge page).

### Task 4: One-click Provider Setup (Dify)

- Preset completion: `DeepSeek` preset gets `baseUrl=https://api.deepseek.com/v1`, model `deepseek-chat`; `OpenAI` gets `baseUrl=https://api.openai.com/v1`; mark `Ollama` as local.
- Agents page: selecting a preset fills `baseUrl`/model automatically, so users enter only `apiKey`; add “Test connection” (make an empty `chat/completions` request and return success/error information).
- Backend: `POST /agents/:id/test` calls the provider to validate configuration.

## Acceptance

- [ ] After chat, Memory contains L1 atomic facts; duplicate conversations do not duplicate extraction (L1 deduplication).
- [ ] L2/L3 can be generated by aggregating L1; the Memory page groups display by L0/L1/L2/L3.
- [ ] A Workspace can set a default Agent; chat uses that Agent rather than the global default.
- [ ] AI answers include `[^n]` citation superscripts; clicking reveals the original chunk.
- [ ] The DeepSeek preset fills `baseUrl`/model in one click, and “Test connection” works.
- [ ] `npm run lint && typecheck && build` all pass; API unit tests pass.
- [ ] End-to-end browser acceptance passes.

## Non-goals

- Symbolic memory (Mermaid canvas) and the Memory visualization panel (Phase 17).
- Code-Graph/LLM-Wiki assets (Phase 18).
- Cross-Workspace memory sharing.
