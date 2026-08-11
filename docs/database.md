# Database Design (Current)

MongoDB (replica set; database name `wade_workspace`) is accessed through **Prisma ORM** (`apps/api/prisma/schema.prisma`). Schema change flow: `prisma generate` → `prisma db push` (development) or migration files (production).

## Data Models

### User / RefreshToken
- **User**: `id` (ObjectId), `name`, unique `email`, `passwordHash`, global `role` (`USER`/`ADMIN`), `avatarUrl`.
- **RefreshToken**: `id`, `userId`, `tokenHash`, `expiresAt`; supports token rotation.

### Workspace / WorkspaceMember
- **Workspace**: `id`, `name`, `icon`, `createdById`, **`defaultAgentId`** (Phase 16: the agent used by default for conversations in this workspace).
- **WorkspaceMember**: unique `workspaceId` + `userId`, with role (`OWNER` > `ADMIN` > `MEMBER`).
- Global roles (`User.role`) and workspace roles (`Member.role`) are **two separate systems**: a global `ADMIN` can view every workspace.

### Channel / Message
- **Channel**: `workspaceId`, `name`, `createdById`.
- **Message**: `channelId`, `senderType` (`USER`/`AGENT`), `status` (`PENDING`/`STREAMING`/`COMPLETED`/`FAILED`), `content`, `feedback` (`like`/`dislike`), `agentId` (the agent that produced the reply).

### Agent (Phases 14/15)
- `type`: `OLLAMA` / `OPENAI_COMPATIBLE` / `ANTHROPIC` / `OPENCLAW` / `HERMES`.
- **`providerConfigRef`** (write-only; the API returns a `hasApiKey` summary), `engineType`, `isDefault`.
- Expert fields: `emoji`, `role`, `description`, `systemPrompt`, **`harness`** (default: `OLLAMA`).
- **`embeddingModel` / `embeddingBaseUrl`** (Phase 15: embeddings are independently configurable).

### KnowledgeDocument / KnowledgeChunk (RAG)
- **KnowledgeDocument**: `workspaceId`, `filename`, `mimeType`, `storageKey`, `extractionStatus`, **`contentHash`** (SHA-256; Phase 15 deduplication skips reindexing the same hash in the same workspace).
- **KnowledgeChunk**: `documentId`, `content`, **`embedding` `Float[]`**, `chunkIndex`, `tokenCount`.

### Memory (Phase 16: layered memory L0→L3)
- **`level`**: `L0_CONVERSATION` / `L1_ATOM` / `L2_SCENARIO` / `L3_PERSONA`.
- `type`: `PERSONAL` (private) / `TEAM` / `PROJECT` (shared).
- **`sourceMessageIds`** (traceability chain that can drill down to original conversations), `parentMemoryId` (hierarchical relation), `priority`, `confidence`, `enabled`, **`embedding`** (L1 deduplication skips cosine similarity > 0.92).

## Key Design Decisions

1. **API keys are write-only**: an agent's `providerConfigRef` is stored, but responses return only the `hasApiKey` boolean to prevent secret disclosure.
2. **RAG deduplication**: `contentHash` (documents) + embedding cosine similarity (memory) prevent duplicate chunking and extraction.
3. **Progressive disclosure** (TencentDB Agent Memory approach): L3 personas guide retrieval → L2 scenarios → L1 atomic facts are drilled down as needed; the full chain is traceable.

## Schema Change Flow

```bash
# Host (after changing the schema)
npm run prisma:generate --workspace=@wade/api
# Inside the container (apply changes to the DB; node_modules are separate, so generate in both places)
docker exec ai-workspace-api-1 sh -c "cd /app/apps/api && npx prisma generate && npx prisma db push --accept-data-loss"
```

> Note: the host and container Prisma clients are **two separate copies**; regenerating only one is insufficient. Prisma does not support optional lists (`Float[]?` → P1012); use `Float[]` with an empty array.
