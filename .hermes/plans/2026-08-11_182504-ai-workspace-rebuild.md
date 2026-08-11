# AI Workspace Secure Provider Platform & Product Rebuild Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not run parallel tasks that modify the Prisma schema or the provider-resolution seam.

**Goal:** Turn the local-first AI Workspace into a secure, testable multi-workspace AI product whose provider credentials are managed independently from agents, encrypted at rest, safely selectable, observable, and usable with the speed of CC Switch without rebuilding a full LLM gateway.

**Architecture:** Preserve the existing Next.js + NestJS + Prisma/MongoDB monorepo. Replace `Agent.providerConfigRef` (a JSON string containing a plaintext API key) with three domain concepts: workspace-scoped **credentials** (encrypted secret material), **provider connections** (endpoint/protocol/default models/reference to one credential), and **agent bindings** (which connection/model an agent uses). Route every LLM/embedding/title/memory call through one provider resolver and adapter boundary. Keep Ollama/local connections first-class and secretless.

**Tech Stack:** Node 22 built-in `node:crypto` (AES-256-GCM), NestJS 11, Prisma 6/MongoDB 7, Next.js 16/React 19, Ant Design, TanStack Query, Jest, Docker Compose. Add no new runtime dependency in Phases 0–4 unless a concrete requirement proves Node/Nest primitives insufficient.

---

## 1. Executive assessment from independent expert lenses

### Product / AI developer experience

The project has a good local-first starting point: authenticated workspaces, agents, streaming chat, knowledge, memory, Swagger, and a working Docker path. However, the current product model makes an **agent simultaneously mean persona + provider + credential + model + embedding configuration**. That is the source of most configuration friction. A developer cannot create a reusable DeepSeek/OpenAI/Anthropic connection, switch several agents to it, see which runtime is active, test it safely, or rotate a credential once.

The current `Agents` page has presets and a write-only password box, but it is a long card editor rather than a provider management workflow. It also has contradictory local endpoint defaults (`OpenClaw`/`Hermes` preset values differ from type defaults) and embeds unrelated agent persona, model, secret, harness, and RAG fields in one form.

**Product decision:** deliver a dedicated **Settings → Providers** experience. Do not copy CC Switch wholesale: desktop config-file synchronization, OAuth account centre, MCP/Skills synchronization, system tray switching, relay marketplace, and full multi-tool support are outside this application's job. Copy the valuable interaction pattern: named presets, reusable profiles, explicit active/default state, fast switching, model discovery, health feedback, import/export of non-secret configuration, and safe secrets UX.

### Security / privacy

**P0 findings grounded in current source:**

1. `apps/api/src/agents/agent-provider-config.ts` serializes `apiKey` into JSON and `AgentsService` saves it in `Agent.providerConfigRef`; it is plaintext in MongoDB, backups, and any direct database inspection.
2. `AgentsService.updateAgent` calls `ensureWorkspaceMember`, not `ensureWorkspaceManager`. A normal workspace member can edit a shared agent endpoint/key/model; `testConnection` is also member-accessible. This is a direct authorization flaw.
3. Arbitrary user-supplied `baseUrl` is fetched by test/chat/embedding paths. Without central URL policy, timeout, DNS/IP validation, or egress controls, this is an SSRF surface against Docker/LAN/cloud metadata addresses.
4. Provider error bodies flow to clients (`normalizeError`) and logging (`EmbeddingService`, `MemoryService`). Third-party bodies can expose request identifiers, internal details, or echoed sensitive material.
5. `apps/api/src/main.ts` enables credentialed CORS for every reflected origin. There is no rate limit, security-header policy, request-size policy, or production configuration validation.
6. `docker-compose.yml` is an explicitly development-oriented stack but exposes MongoDB on the host, supplies a default JWT fallback, runs `prisma db push` and seed on API startup, bind-mounts source, and has no production deployment profile. It must never be described as production-ready.

### Architecture / backend

Provider routing is duplicated and bypassed: default chat uses adapters, title generation calls Ollama directly in `ChatService`, memory re-parses the old agent JSON and calls the provider directly, and embeddings have their own partial rules. This produces inconsistent credentials, error handling, model selection, and auditability.

The current RAG implementation reads up to 500 chunks and ranks cosine similarity in Node (`KnowledgeRepository`). It is adequate for a demo but has an intentional small-data ceiling; it should be guarded by limits/metrics now and moved behind a retrieval interface before scale work. MongoDB/Prisma have no migration-history process; `PrismaService` also executes data repair at startup.

### Frontend / accessibility

The app has useful loading/empty primitives and permission-aware controls, but provider configuration needs a distinct information architecture, field-level help, unsaved-change behavior, keyboard-safe modal/drawer interactions, and predictable connection test state. Every sensitive value must be write-only: never hydrate it into form state after save, never include it in query cache, never show it in error/toast text, and only show `••••last4`/status metadata from the API.

### QA / SRE / maintainability

The repository has unit coverage (15 API specs) and root lint/typecheck/test/build scripts, but no end-to-end API tests, browser tests, CI quality workflow, dependency/security scanning, config validation test, migration rehearsal, provider-contract fixtures, or release/deploy separation. The only GitHub workflow deploys static Pages. The service lacks correlation IDs, structured redacted logs, provider latency/error metrics, usage records, health state, and an operational runbook.

### External comparison and applicability

| Source | Reusable lesson | Explicit non-goal for this plan |
|---|---|---|
| [CC Switch](https://github.com/farion1231/cc-switch) | Presets, named profiles, one active config, fast switching, test/latency feedback, safe config import/export. | Do not become a cross-tool desktop configuration synchronizer or relay marketplace. |
| [Open WebUI provider connections](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/) | Separate provider connection from chat; auto-discover models where protocol permits; local and cloud endpoints coexist. | Do not add every protocol/provider upfront. |
| [Dify model-provider plugins](https://docs.dify.ai/en/develop-plugin/dev-guides-and-walkthroughs/creating-new-model-provider) | Provider-specific credential schemas and server-side credential validation. | Do not build a plugin marketplace in the first refactor. |
| [LiteLLM virtual keys](https://docs.litellm.ai/docs/proxy/virtual_keys) | Model-level access, rotation, ownership, budgets, usage metadata. | Do not ship a public proxy, virtual-key API, or billing system before actual multi-user demand. |

---

## 2. Target domain model and security contract

### 2.1 Roles and scope

- `OWNER` / `ADMIN`: may create, edit, test, rotate, disable, or delete a workspace provider connection/credential; may bind it to agents; may view audit metadata.
- `MEMBER`: may use an enabled connection through agents they are permitted to use; can view non-secret connection summaries required to understand an agent; cannot mutate, test, or reveal credentials.
- Global `ADMIN`: is an authorized workspace manager through the existing global-admin rule; all actions still emit workspace audit records.
- Phase 1 uses **workspace-owned credentials only**. Personal BYOK is a separately gated Phase 6 feature because it changes sharing, revocation, and auditing semantics.

### 2.2 New persisted records

Replace overloaded agent JSON with the following Prisma/MongoDB models. Names are recommended; maintainers may adjust field names but not responsibilities.

1. `ProviderCredential`
   - `id`, `workspaceId`, `name`, `providerKind`, `encryptedPayload`, `encryptionKeyVersion`, `fingerprintHmac`, `last4`, `status` (`ACTIVE|ROTATING|REVOKED`), `createdBy`, `rotatedAt`, timestamps.
   - Only `encryptedPayload` can contain the raw API key. It is AES-256-GCM ciphertext plus IV/tag, never JSON plaintext.
   - `fingerprintHmac` is keyed HMAC-SHA-256 of the normalized secret; use it only for duplicate detection/audit correlation. Never use bare SHA-256.
2. `ProviderConnection`
   - `id`, `workspaceId`, `name`, `providerKind` (`OLLAMA|OPENAI_COMPATIBLE|ANTHROPIC` initially), `baseUrl`, `credentialId?`, `defaultChatModel?`, `defaultEmbeddingModel?`, `enabled`, `isWorkspaceDefault`, `lastTestStatus`, `lastTestedAt`, `lastLatencyMs?`, `lastErrorCode?`, timestamps.
   - It contains no secret. `OLLAMA` has no `credentialId`.
3. `ProviderUsageEvent`
   - `workspaceId`, `connectionId`, `agentId?`, `operation` (`CHAT|TITLE|MEMORY|EMBEDDING|TEST`), `model`, `status`, `latencyMs`, `promptTokens?`, `completionTokens?`, `providerRequestId?`, `errorCode?`, timestamp.
   - It stores no prompt, completion, header, base response, or secret.
4. `AuditEvent`
   - `workspaceId`, `actorUserId`, `action`, `resourceType`, `resourceId`, redacted `metadata`, timestamp.
   - Required actions: credential created/rotated/revoked/deleted, connection created/updated/tested/enabled/disabled, agent binding changed, migration completed.

Modify `Agent` to use `providerConnectionId?`, `chatModel?`, `embeddingConnectionId?`, `embeddingModel?`. Preserve its name, persona, prompt, default state, and role. Drop `providerConfigRef`, `type`, `harness`, `embeddingBaseUrl` only after the migration is verified and old data removed. Do not leave a forever dual-read path.

### 2.3 Cryptographic and configuration rules

- Create `CREDENTIAL_ENCRYPTION_KEY` as a required base64-encoded 32-byte key outside local test mode. Validate it at startup; fail closed if invalid/missing in non-development environments.
- Use `node:crypto`: random 12-byte IV, `createCipheriv('aes-256-gcm', key, iv)`, associated data `workspaceId:credentialId`, auth tag persisted separately, ciphertext encoded base64. Include an algorithm/version envelope.
- Support rotation with `CREDENTIAL_ENCRYPTION_KEY_PREVIOUS` for one deployment window. Decrypt old records with the matching version and re-encrypt each record lazily/on explicit maintenance command; remove prior key only after an audit-backed completion count is zero.
- Do not log raw DTOs, HTTP headers, request bodies, provider response bodies, generated ciphertext, fingerprint HMAC, or `last4` in normal logs. Install a recursive redaction utility for keys such as `apiKey`, `authorization`, `x-api-key`, `token`, `secret`, and `encryptedPayload`.
- Environment secrets are **system defaults**, read-only and not exposed to browser/API listing endpoints. Define a single precedence order: explicit agent binding → workspace connection/default → system local Ollama/default environment. Return the selected connection/model origin as metadata only.
- Export/import supports connection metadata, model choices, and agent bindings only. It must omit credential records and must reject secret-shaped fields on import.

### 2.4 Network and error contract

- Centralize endpoint validation. Cloud connections require `https`; local `http` is allowed only for an explicit local provider mode plus a configured allowlist (e.g. `localhost`, `127.0.0.1`, `host.docker.internal`, Docker service `ollama`). Reject URL credentials, non-http(s), malformed ports, and private/link-local/loopback targets when cloud mode is selected.
- Re-resolve DNS immediately before request and deny resolved private/reserved addresses for cloud connections to mitigate DNS rebinding. Apply an allowlist rather than a blocklist for local services.
- Use Node 22 `AbortSignal.timeout` and a response-size cap for validation/model-discovery requests; no automatic retry for non-idempotent chat requests. Retry only explicitly classified transient idempotent validation/discovery calls with bounded exponential backoff.
- Map provider errors to stable public codes (`AUTH_FAILED`, `RATE_LIMITED`, `MODEL_UNAVAILABLE`, `CONNECTION_TIMEOUT`, `CONNECTION_REFUSED`, `PROVIDER_ERROR`) and an opaque request ID. Preserve detailed redacted cause only in server logs/audit metadata.

---

## 3. Workstream order, ownership, and gates

| Phase | Owner / reviewer | Outcome | Hard gate |
|---|---|---|---|
| 0. Baseline and safety | Tech lead + QA | Reproducible baseline, backup, threat-model decisions. | No schema/code refactor before backup and role exploit regression test exist. |
| 1. Secret and authorization foundation | Backend + Security reviewer | Encrypted credentials, manager-only controls, SSRF/error guards. | Plaintext secret scan and authorization/crypto tests pass. |
| 2. Provider domain and routing | Backend + Architecture reviewer | Connections, resolver, adapters; all LLM paths unified. | No direct provider `fetch` remains outside adapters/test code. |
| 3. Provider console and agent binding UX | Frontend + UX reviewer | Fast reusable connection workflow; no secret enters query cache. | Browser/API acceptance matrix passes. |
| 4. RAG/memory/data correctness | Backend + AI/RAG reviewer | Bounded retrieval and unified embeddings; data lifecycle clarity. | Retrieval/memory regression and performance ceiling test pass. |
| 5. Production hardening / observability | DevOps + Security reviewer | Config validation, CI, logs, metrics, deploy profiles. | Clean CI, vulnerability policy, production compose smoke test. |
| 6. Measured enhancements | PM + Architecture reviewer | Usage/cost summaries, optional personal BYOK, only if justified. | Usage privacy review and product decision record. |

Each phase is independently shippable. Commit one logical vertical slice per task group with English Conventional Commit messages. Do not mix existing unrelated UI/generated-file changes into these commits.

---

## 4. Implementation plan

## Phase 0 — protect current users and establish proof

### Task 0.1: Freeze the current provider contract in tests

**Files:**
- Modify: `apps/api/src/agents/agents.service.spec.ts`
- Modify: `apps/api/src/agents/agents.controller.ts` tests/add controller test file as needed
- Create: `apps/api/src/agents/agents.authorization.spec.ts`

**Steps:**
1. Add a regression test proving a `MEMBER` receives 403 for create/update/delete/test operations, while `OWNER`, workspace `ADMIN`, and global admin receive the expected result.
2. Add a test that confirms API list/create/update responses do not contain `apiKey` or `providerConfigRef`.
3. Run the focused Jest suite; it must fail before changing authorization.
4. Record source-of-truth role behavior in `docs/security.md` (create it in Phase 1) rather than leaving it implicit.

**Verify:** `npm run test --workspace=@wade/api -- agents` passes after Phase 1.

### Task 0.2: Make a rollback-safe data snapshot and inventory

**Files:**
- Create: `scripts/provider-config-audit.ts`
- Create: `docs/runbooks/provider-credential-migration.md`

**Steps:**
1. Implement a local-only read-only inventory command that reports counts of agents with legacy config, keys present, and malformed JSON; it must never print values or full endpoint query strings.
2. Document a Mongo backup/restore rehearsal for local development and the explicit persistent-volume warning.
3. Run the inventory against a copy/backup before migration; save only count results in the deployment log.
4. Add `npm run audit:provider-config --workspace=@wade/api`.

**Verify:** script output contains aggregate counts and `[REDACTED]` for any secret-like input.

### Task 0.3: Write the ADR and threat model

**Files:**
- Create: `docs/adr/ADR-001-provider-credentials.md`
- Create: `docs/security.md`

**Steps:**
1. Record the workspace-scoped v1 decision, encryption key ownership, key rotation procedure, URL/SSRF policy, audit retention, threat actors, and non-goals.
2. Include the accepted risk for trusted Docker-network local services and the explicit mitigation for cloud endpoints.
3. Require reviewer sign-off before schema migration begins.

---

## Phase 1 — secret security and authorization

### Task 1.1: Add strict server configuration validation

**Files:**
- Create: `apps/api/src/config/config.schema.ts`
- Create: `apps/api/src/config/config.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `.env.example`, `apps/api/.env.example`, `README.md`, `docs/security.md`
- Test: `apps/api/src/config/config.service.spec.ts`

**Steps:**
1. Define typed configuration for environment, JWT, credential encryption key, CORS allowlist, provider local-host allowlist, timeout, upload limit, and log level.
2. Fail startup outside test/development when JWT or credential encryption key is placeholder/missing/invalid.
3. Replace `origin: true` with a parsed explicit allowlist; allow local origins only in development.
4. Add body-size limits and a global exception filter that emits request IDs and safe messages.
5. Add security response headers through Nest/Express configuration; document any minimal dependency added and why.

**Verify:** invalid config unit tests fail closed; application boot smoke test succeeds with valid redacted test keys.

### Task 1.2: Implement a dedicated encryption/redaction seam

**Files:**
- Create: `apps/api/src/security/credential-crypto.service.ts`
- Create: `apps/api/src/security/redaction.ts`
- Create: `apps/api/src/security/security.module.ts`
- Test: `apps/api/src/security/credential-crypto.service.spec.ts`

**Steps:**
1. Test first: encrypt/decrypt round trip, random IV makes two ciphertexts differ, wrong AAD/key rejects, malformed envelope rejects, previous key decrypts only when configured, and redaction never retains a sentinel secret.
2. Implement versioned AES-GCM envelope and HMAC fingerprint with Node crypto only.
3. Implement safe-error and recursive redaction helpers; unit-test nested DTO/header/error objects.
4. Add a repository grep test/CI rule that blocks logging of known secret fields.

**Verify:** no test output contains the sentinel secret; focused Jest suite passes.

### Task 1.3: Enforce manager-only mutation before feature migration

**Files:**
- Modify: `apps/api/src/agents/agents.controller.ts`
- Modify: `apps/api/src/agents/agents.service.ts`
- Create: `apps/api/src/common/guards/workspace-manager.guard.ts`
- Test: `apps/api/src/common/guards/workspace-manager.guard.spec.ts`

**Steps:**
1. Reuse one manager guard/service rule; do not duplicate role checks in each controller.
2. Apply it to all current agent mutations and test routes immediately.
3. Keep list/read behavior explicit and review whether `MEMBER` needs full agent system prompts; redact prompts from member summaries if prompts can contain operational secrets.
4. Remove `ensureWorkspaceMember` from mutation paths after the guard is proven.

**Verify:** Task 0.1 role matrix passes; member cannot alter an endpoint/key or invoke an outbound test.

### Task 1.4: Build safe endpoint validation and provider error classification

**Files:**
- Create: `apps/api/src/ai/provider-network-policy.service.ts`
- Create: `apps/api/src/ai/provider-error.ts`
- Test: `apps/api/src/ai/provider-network-policy.service.spec.ts`
- Modify: current provider classes only after Task 2.4 centralizes request execution.

**Steps:**
1. Test URL parsing, cloud HTTPS-only rule, no URL credentials, local allowlist behavior, CIDR/reserved address detection, redirect rejection, timeout, and response-size limit.
2. Define typed internal `ProviderError` and safe public payload.
3. Do not release a broad "custom endpoint" escape hatch. If an enterprise endpoint needs it later, add an auditable admin-managed allowlist.

---

## Phase 2 — provider domain, migration, and one routing seam

### Task 2.1: Add the new schema without deleting legacy fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/` or documented Mongo migration scripts under `apps/api/prisma/migrations/`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/src/prisma/provider-schema.spec.ts` or integration migration test

**Steps:**
1. Add enums/models from Section 2.2 and indexes for workspace/list/status/audit/usage queries.
2. Add nullable connection references to `Agent`; retain legacy fields for one release only.
3. Stop performing schema/data mutation in `PrismaService.onModuleInit`; move all migration/backfill into explicit idempotent scripts.
4. Replace `prisma db push` as the production mechanism with an explicit migration command. Keep `db:push` documented only for disposable local development if Mongo constraints require it.

**Verify:** a blank database seeds; an old fixture database can read before backfill; schema generation/typecheck passes.

### Task 2.2: Implement credential and connection repositories/services

**Files:**
- Create: `apps/api/src/providers/providers.module.ts`
- Create: `apps/api/src/providers/provider-credentials.service.ts`
- Create: `apps/api/src/providers/provider-connections.service.ts`
- Create: `apps/api/src/providers/provider-catalog.ts`
- Create: DTO/controller/spec files under `apps/api/src/providers/`

**Steps:**
1. Start with only `OLLAMA`, `OPENAI_COMPATIBLE`, and `ANTHROPIC`; create a typed catalog describing display name, protocol, auth fields, local/cloud support, and known default models.
2. Implement manager-only CRUD; DTO validation must distinguish omitted secret (keep) from an explicit rotate/revoke operation. Never overload empty string as deletion.
3. Return a `CredentialSummary` (`id`, name, status, last4, rotatedAt) and a `ConnectionSummary`; never return encrypted fields, plaintext, raw provider errors, or internal key versions.
4. Require an enabled active credential for a cloud connection; a disabled/revoked credential makes the connection unavailable.
5. Emit audit events for every state-changing operation.

**Verify:** full CRUD/authorization/audit/secret-non-disclosure suite passes.

### Task 2.3: Perform a one-time legacy configuration migration

**Files:**
- Create: `apps/api/prisma/migrations/migrate-agent-provider-config.ts`
- Create: `apps/api/prisma/migrations/migrate-agent-provider-config.spec.ts`
- Modify: `docs/runbooks/provider-credential-migration.md`

**Steps:**
1. Parse every legacy `providerConfigRef` strictly; create one encrypted credential and one named connection per unique `(workspace, endpoint, secret fingerprint)`; bind affected agents.
2. Use transactions/batched idempotent writes where Prisma/Mongo allows. Mark a migration record/audit event so re-runs do not duplicate records.
3. On malformed records: leave legacy data intact, write a safe migration issue record with agent ID only, and halt/return nonzero according to documented operator choice.
4. Do not print legacy JSON, even in debugging. Back up first and verify aggregate counts after migration.
5. After a full release and rollback window, write a separate removal migration to null/delete legacy `providerConfigRef` and remove it from schema/code/tests.

**Verify:** fixture with same secret across two agents deduplicates correctly; fixture with invalid JSON reports safely; migration is idempotent.

### Task 2.4: Centralize resolution, protocol adaptation, and execution

**Files:**
- Create: `apps/api/src/ai/provider-resolver.service.ts`
- Create: `apps/api/src/ai/provider-executor.service.ts`
- Modify: `apps/api/src/ai/providers/ai-provider.ts`
- Modify: `apps/api/src/ai/providers/openai-compatible.provider.ts`
- Modify: `apps/api/src/ai/providers/anthropic.provider.ts`
- Modify: `apps/api/src/ai/engines/default-chat.engine.ts`
- Modify: `apps/api/src/ai/embedding.service.ts`
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Test: provider resolver/executor/adapter specs

**Steps:**
1. Define a provider request context with workspace, operation, agent, binding, model, connection, decrypted secret held only in local function scope, timeout, and correlation ID.
2. Resolver chooses the agent binding/default connection/system fallback according to the documented precedence and verifies role/status/model capability.
3. Executor applies network policy, headers, timeout, error mapping, redacted structured logs, and usage/audit events exactly once.
4. Refactor default chat, title generation, memory extraction/scenario aggregation, and embeddings to use resolver/executor. Delete direct `fetch` calls to model endpoints outside adapter/executor code.
5. Preserve SSE streaming and abort semantics. Record usage only after a final/failed event; never buffer whole chat just for metrics.

**Verify:** source search shows no provider endpoint fetch in `chat.service.ts`, `memory.service.ts`, or `embedding.service.ts`; all three operations use the same mock connection and redaction tests pass.

### Task 2.5: Add safe connection test and model discovery

**Files:**
- Modify: `apps/api/src/providers/provider-connections.controller.ts`
- Modify: `apps/api/src/providers/provider-connections.service.ts`
- Create: `apps/api/src/providers/provider-discovery.service.ts`
- Tests: controller/service/network policy specs

**Steps:**
1. Test only persisted or ephemeral manager-owned connection drafts; do not expose a generic arbitrary URL fetch endpoint to members.
2. Validate a lightweight protocol-appropriate request and report latency, safe status, and available models when endpoint supports discovery.
3. Persist only stable test metadata, not response payloads.
4. Cache discovery data briefly per connection if it is introduced; invalidate on endpoint/credential change. Do not implement background polling in this phase.

---

## Phase 3 — fast provider and agent UX

### Task 3.1: Create provider API types and query boundaries

**Files:**
- Create: `apps/web/src/lib/providers.ts`
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/lib/providers.test.ts` using `node:test`

**Steps:**
1. Define narrow API response types that omit secrets by construction.
2. Create TanStack Query keys for connections, credential summaries, test result, discovery, audit, and agent bindings.
3. Keep mutation input objects in the submit function; never store raw secrets in Zustand, URL state, localStorage, React Query cache, error boundaries, or analytics.

### Task 3.2: Replace the provider portion of Agents with a Provider Console

**Files:**
- Create: `apps/web/src/components/providers-page.tsx`
- Create: `apps/web/src/components/provider-connection-form.tsx`
- Create: `apps/web/src/components/provider-card.tsx`
- Create: `apps/web/src/components/provider-presets.ts`
- Create: `apps/web/src/app/(workspace)/settings/providers/page.tsx`
- Modify: `apps/web/src/components/workspace-navigation.tsx`
- Modify: `apps/web/src/components/agents-page.tsx`

**Interaction specification:**
1. Providers page: connection cards/table with provider icon, connection name, endpoint host, default chat/embedding model, enabled/disabled state, `No credential`/`Active`/`Needs rotation`, last test status/latency/time, and `Use as workspace default`.
2. `Add connection` opens a focus-trapped drawer/modal: choose preset or custom protocol; then endpoint, credential selection/create, model selection/manual entry, test, save. Local Ollama does not render credential fields.
3. Credential rotate is a distinct confirmation action: new password input, clear copy explaining it immediately replaces the old secret, then a required successful test or an explicit save-without-test confirmation.
4. Connection test shows spinner, timeout-safe error code/help, latency, and discovered model count; never render raw response/error text.
5. Export button exports only non-secret JSON; import previews diff and warns credentials must be entered separately.
6. Use labels and descriptions in plain English; not internal field names (`baseUrl`, `apiKey`). Inputs have associated labels, help/error text, keyboard submit/cancel, focus return, visible permission-disabled explanations, and responsive layout.

**Verify:** a manager completes OpenAI-compatible, Anthropic, and Ollama setup without visiting the agent editor; a member sees a read-only summary and no mutation controls.

### Task 3.3: Simplify the agent editor to binding and persona

**Files:**
- Modify: `apps/web/src/components/agents-page.tsx`
- Modify: workspace agent context types in `apps/web/src/components/workspace-context.tsx`
- Modify: `apps/api/src/agents/` DTO/service/controller after the new binding API exists

**Steps:**
1. Replace secret/base URL/embedded protocol fields with `Connection`, `Chat model`, optional `Embedding connection/model`, and persona fields.
2. Show resolved origin: `Agent override`, `Workspace default`, or `System local default`.
3. Give agents a connection health badge; disable send only when no usable resolved connection exists, with a link to Providers for managers.
4. Preserve existing agent records/personas through the migration. Do not silently reset defaults.

**Verify:** changing one connection updates every bound agent; rotating a credential requires no agent edit; unbound agent follows documented fallback.

### Task 3.4: Browser acceptance and accessibility checks

**Files:**
- Create: `apps/web/e2e/providers.spec.ts` (select Playwright only after Phase 5 test-tool decision)
- Or create: `apps/web/src/components/providers-page.test.tsx` if project adopts a DOM test tool
- Modify: `docs/testing.md`

**Scenarios:** owner setup/test/rotate/disable; member forbidden API and disabled UI; error has no secret; local Ollama no secret; custom cloud endpoint rejected; reload preserves metadata but not secret; keyboard-only create/edit; narrow viewport.

---

## Phase 4 — RAG, memory, and data lifecycle

### Task 4.1: Put retrieval behind an explicit interface and declare its ceiling

**Files:**
- Create: `apps/api/src/repositories/vector-search.repository.ts`
- Modify: `apps/api/src/repositories/knowledge.repository.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Test: `apps/api/src/repositories/vector-search.repository.spec.ts`
- Modify: `docs/architecture.md`

**Steps:**
1. Extract duplicate cosine similarity implementation from `KnowledgeRepository` and `MemoryService` into one tested helper/repository.
2. Keep current Mongo in-process ranking temporarily but put candidate/document/top-k limits in typed config and return telemetry when the ceiling is reached.
3. Define the next backend contract (Mongo Atlas Vector Search or Qdrant) without deploying it. Choose only after measuring corpus size, latency, and retrieval quality.
4. Ensure embedding configuration is resolved by the provider resolver; never inherit an API key by reparsing an agent or assume OpenAI protocol for Anthropic.

### Task 4.2: Make knowledge/memory ownership, retention, and failure states explicit

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/knowledge/knowledge.service.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Modify: `docs/database.md`, `docs/security.md`

**Steps:**
1. Define owner/visibility semantics for personal/team/project memory and enforce them at query time; document whether workspace admins may read each class.
2. Add deletion propagation: deleting a document removes chunks/embeddings; deleting or disabling a memory removes it from prompts; record safe audit metadata.
3. Replace best-effort swallowed errors with user-safe status plus redacted operator telemetry. Memory extraction must not silently turn a credential/connection policy failure into ambiguous success.
4. Add quotas/size limits per workspace for documents, chunks, and memory; show controlled errors.

**Verify:** cross-workspace access regression tests; delete/disable propagation tests; provider error contains no secret.

---

## Phase 5 — platform, security, testing, and developer experience

### Task 5.1: Split development Compose from production deployment

**Files:**
- Modify: `docker-compose.yml` (or rename to `compose.dev.yml`)
- Create: `compose.production.yml`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Modify: `.env.example`, `README.md`, `docs/runbooks/deployment.md`

**Steps:**
1. Keep source bind mounts, hot reload, exposed Mongo port, model pulling, seed data, and `db push` only in development.
2. Build immutable production images; run as non-root; use explicit environment/config validation; do not seed on every boot; do not publish MongoDB by default.
3. Configure health/readiness checks and restart policy. Terminate TLS at a documented reverse proxy/deployment platform rather than pretending Compose alone provides HTTPS.
4. Provide a backup/restore procedure and clarify that `docker compose down -v` destroys local data.

### Task 5.2: Add an actual CI quality gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`, `apps/api/package.json`, `apps/web/package.json`
- Create: `.github/dependabot.yml` or documented dependency update policy

**Steps:**
1. CI on pull requests/main: clean install (`npm ci`), Prisma generation, lint, typecheck, API unit tests with coverage threshold, web tests, production builds, compose config validation, secret scan, and dependency audit with an explicit severity policy.
2. Cache dependencies safely; never inject real provider secrets. Use deterministic fake credentials only.
3. Add OpenAPI contract snapshot/diff check so provider API changes are deliberate.
4. Make Pages deployment depend on its own narrow job; do not couple it to secret-requiring service tests.

### Task 5.3: Add observability without collecting user content

**Files:**
- Create: `apps/api/src/observability/observability.module.ts`
- Create: `apps/api/src/observability/request-context.middleware.ts`
- Modify: `apps/api/src/main.ts`, provider executor, error filter
- Create: `docs/runbooks/operations.md`

**Steps:**
1. Add structured JSON logs with request ID, workspace/actor/resource IDs only where authorization permits, operation, status class, latency, provider kind, connection ID, and redacted error code.
2. Add health/readiness detail that does not disclose endpoint/secret/config values.
3. Expose an authenticated manager-only connection health/usage view; do not create public Prometheus infrastructure unless there is a collector to receive it.
4. Define alert signals: consecutive connection failures, auth failures after rotation, timeout rate, migration failure, and storage quota threshold.

### Task 5.4: Establish a layered test strategy

**Files:**
- Modify: `docs/testing.md`
- Create: API test helpers under `apps/api/src/test/`
- Create: provider contract fixtures under `apps/api/src/ai/providers/fixtures/`

**Required test layers:**
- Unit: crypto, redaction, URL policy, DTOs, resolver precedence, protocol parsers/SSE, error classification, authorization.
- Service/integration: encrypted CRUD, rotation/revocation, legacy migration idempotency, all LLM call sites, workspace isolation, audit/usage persistence.
- Contract: mocked OpenAI-compatible and Anthropic response/error/SSE fixtures; no live paid-provider test in CI.
- E2E: auth/roles, provider console flows, chat after provider switch, knowledge/memory provider flow.
- Release smoke: fresh Compose dev startup; upgrade fixture database migration; production image startup with mock service.

---

## Phase 6 — only after real usage data justifies it

1. **Usage/cost dashboard:** show connection/model/request counts, latency/error rate, provider-reported tokens, and optional estimated cost. Keep estimates labelled and configurable; do not promise billing accuracy.
2. **Soft workspace budgets:** warn at thresholds first. Hard budget enforcement requires a clear policy for concurrency/race conditions and a usage reconciliation model.
3. **Personal BYOK:** add `scope=USER|WORKSPACE`, explicit sharing/binding rules, user deletion/rotation lifecycle, and a new threat-model review. Do not retrofit it into Phase 1 tables casually.
4. **More protocols:** add Azure/OpenAI Responses, Gemini, Bedrock, OAuth only through catalog schema + adapter + test fixture + security review. Never ship provider-specific ad-hoc fields in agent forms.
5. **Vector backend:** migrate only if Phase 4 metrics show the in-process candidate ceiling harms latency/quality.

---

## 5. Definition of done / release acceptance

A release is eligible only when all statements are true:

- [ ] Database inspection and backups contain no plaintext provider API key after migration; `Agent.providerConfigRef` is gone after its one-release deprecation window.
- [ ] A `MEMBER` cannot create/update/test/rotate/disable/delete provider credentials/connections or agent bindings through UI or API; owner/admin/global-admin matrix is tested.
- [ ] No provider URL request can bypass the central resolver/executor/network policy; title, chat, memory, and embedding paths all use it.
- [ ] Provider API responses, logs, Swagger examples, tests, browser storage, TanStack cache, audit metadata, and error messages do not contain raw secrets.
- [ ] Credential rotation and revocation change behavior for every bound agent without editing each agent; migration/retry/rollback runbooks are rehearsed.
- [ ] Provider console supports local Ollama, OpenAI-compatible, and Anthropic via named reusable connections, preset/custom setup, safe test, health metadata, model selection, and non-secret export/import.
- [ ] RAG/memory has documented ownership/retention and bounded retrieval behavior; no cross-workspace retrieval test can pass.
- [ ] CI runs lint/typecheck/unit/contract/build/config/secret checks; a clean production image and a clean developer Compose stack both pass smoke checks.
- [ ] Production docs clearly distinguish local dev from deployment and never include a usable default JWT/credential encryption key.

## 6. Explicit non-goals and decisions needed before implementation

**Non-goals for the first rebuild:** a public LiteLLM-compatible proxy; model billing/invoicing; 50+ built-in providers; OAuth account management; marketplace; arbitrary plugin execution; background model polling; multi-region/high-availability deployment; changing database technology solely for fashion.

**Decisions for you before Phase 2 begins:**

1. Is v1 a trusted single-user/local product, or a shared team service exposed beyond the LAN? This determines whether HTTPS/reverse proxy and SSRF policy are release blockers rather than documented constraints.
2. Where will `CREDENTIAL_ENCRYPTION_KEY` live in every target environment (local `.env`, CI secret, production secret manager)? Do not implement encryption until an ownership/recovery policy exists.
3. Should workspace members see agents' full system prompts? Recommended default: no; expose role/description only.
4. Does the expected first deployment need external cloud endpoints reachable from a server, or is it local macOS + Docker/Ollama only? This selects the allowlist and connection-test policy.

---

## 7. Reconciled late-review findings — mandatory additions

The independent security, frontend, architecture, and reliability reviews completed after the first draft. The following items are now explicit blockers or required additions; they do not change the provider-domain direction above.

### Task 0.4: Close non-provider cross-tenant authorization paths

**Files:**
- Modify: `apps/api/src/memory/memory.controller.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Modify: `apps/api/src/stats/stats.service.ts`
- Modify: relevant controller/service specs under `memory/` and `stats/`

**Steps:**
1. Apply `ChannelMemberGuard` to `POST /channels/:channelId/memories/extract`, pass the guarded workspace scope into the service, and query the channel by both channel and workspace ID.
2. Make the existing organization/feedback dashboard global-admin-only immediately, or replace it with an explicitly workspace-scoped route guarded by `WorkspaceMemberGuard`; every aggregate query must filter workspace ID.
3. Add outsider/ordinary-member negative tests. Do not release any provider feature while either route permits cross-workspace reads or paid LLM work.

**Verify:** authenticated user in workspace B receives 403 for workspace A channel extraction and cannot enumerate feedback/channel data from any other workspace.

### Task 0.5: Fix provider-editor correctness before replacing it

**Files:**
- Modify: `apps/web/src/components/agents-page.tsx`
- Modify: `apps/api/src/agents/dto/update-agent.dto.ts`
- Modify: `apps/api/src/agents/agents.service.ts`
- Test: `apps/api/src/agents/agents.service.spec.ts`

**Steps:**
1. Until the Connections page lands, either persist `type` atomically with endpoint/model and verify the selected adapter changes, or remove type selection from the legacy editor. The current UI reports success while server-side validation strips `type`.
2. Choose one source of truth for workspace default agent: retain `Workspace.defaultAgentId`, derive UI default state from it, and plan a separate migration to remove `Agent.isDefault` only after all existing references are reconciled.
3. Define provider/harness presets once; current Hermes/OpenClaw port defaults conflict. In Docker-on-macOS docs, use an explicit `host.docker.internal` option rather than assuming container `localhost` reaches host runtimes.

**Verify:** an accepted provider protocol change is observable in a subsequent test request; no UI can state a changed protocol when the server kept the old one.

### Task 4.3: Introduce a durable, minimal job state for expensive work

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/jobs/` module (job model, repository, worker, recovery)
- Modify: `apps/api/src/knowledge/knowledge.service.ts`
- Modify: `apps/api/src/memory/memory.service.ts`
- Test: job recovery/idempotency specs

**Steps:**
1. Replace `setImmediate` document processing with a persisted job record containing workspace/document scope, state, attempts, lease/heartbeat, idempotency key, safe error code, and timestamps.
2. Start with an in-process worker and bounded per-workspace concurrency. Do not introduce Redis, Kafka, or a workflow engine without measured load.
3. On startup, recover expired leases and retry only classified transient failures. Mark permanent errors with user-visible retry guidance.
4. Process documents in bounded batches; do not use unbounded `Promise.all` for chunks/embeddings. Attach indexing model/version/dimension metadata to every vector so embedding-model changes can trigger controlled reindexing.

**Verify:** process restart during a job does not strand it in `PROCESSING`; repeated upload/job dispatch does not duplicate chunks; an embedding-provider timeout follows the retry policy.

### Task 4.4: Make chat and memory output idempotent and bounded

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/chat/chat.service.ts`, `chat.controller.ts`, and SSE client code
- Modify: `apps/api/src/memory/memory.service.ts`
- Tests: chat/memory integration specs

**Steps:**
1. Add a client-generated `generationId` or idempotency key unique per channel; duplicate browser/reverse-proxy submissions must reuse/return the existing generation rather than immediately create another paid AI message.
2. Add a structured SSE terminal event, heartbeat, and explicit cancel behavior. Do not build replay/resume until real reconnect requirements exist.
3. Enforce total prompt budgets for history, memory, and retrieved chunks; retrieval should use a similarity threshold and diversity/dedup rule, not blindly inject five chunks.
4. Do not auto-create `PERSONAL` memory until message-author attribution is explicit. Validate structured extraction output instead of using broad regex JSON extraction.

**Verify:** duplicate POST produces one billed generation/message; abort leaves a clearly classified final state; changing a memory/document embedding model does not compare incompatible vectors silently.

### Task 5.5: Repair contract and browser-security drift

**Files:**
- Modify: `docs/api-contracts.md`, `docs/database.md`
- Modify: `apps/web/src/lib/api.ts`, `stores/auth.ts`
- Create: OpenAPI snapshot/contract verification in CI

**Steps:**
1. Treat generated Swagger/OpenAPI as the API source of truth; repair documented fields/routes that do not match Prisma/controllers and establish an explicit compatibility/deprecation rule.
2. Replace permissive array-or-envelope `unwrapItems()` compatibility once APIs have one stable response envelope.
3. For internet-facing deployments, move refresh token storage from `localStorage` to an HttpOnly/Secure/SameSite cookie and retain access token in memory. If keeping local storage for trusted local-only use, state that boundary prominently in the deployment docs.
4. Add the first focused web tests around API 401 refresh single-flight, SSE parser, and provider mutation error handling. The current `node --test` gate finding zero tests must not be presented as meaningful coverage.

**Verify:** OpenAPI snapshot matches the running API; docs have no claims for absent schema fields; web test report lists executed tests; browser storage inspection contains no provider secret and follows the selected token policy.

## 8. Final execution commands

Run after each task group, not only at the end:

```bash
npm run lint
npm run typecheck
npm test
npm run build
docker compose config --quiet
```

Focused API examples:

```bash
npm run test --workspace=@wade/api -- credential-crypto
npm run test --workspace=@wade/api -- provider-network-policy
npm run test --workspace=@wade/api -- providers
npm run test --workspace=@wade/api -- agents.authorization
```

Before production release, run the migration rehearsal against an anonymized copy of data, execute the role/API/browser acceptance matrix, run a secret-pattern scan that reports file paths only, verify fresh image startup, and test rollback using the documented backup. Never paste real credentials into CI logs, plan artifacts, commits, or bug reports.

## Round 2 audit (2026-08-11 20:53, three parallel subagents: frontend, RAG/embedding, jobs/observability/deployment)

Fixed already (this session, cheap one-liners, commit `cf432e0`):
- Multer `limits.fileSize` on upload interceptor (was buffering unbounded before size check).
- `buildStorageKey` now uses `randomUUID()` instead of `Date.now()` (concurrent-upload collision).
- `app.enableShutdownHooks()` added.

### P0 / Complex — route to Copilot GPT-5.6 (cross-file, architecture, migration)
1. Vector search: replace `Float[]` + brute-force JS cosine similarity with pgvector `vector` column + HNSW/ivfflat index + `$queryRaw` ANN query (`knowledge.repository.ts`, `schema.prisma`). Remove `MAX_DOCUMENT_CANDIDATES`/`MAX_CHUNK_CANDIDATES` silent truncation once indexed.
2. Real job queue for document processing (`knowledge.service.ts:scheduleProcessing`, currently bare `setImmediate`): add BullMQ/Redis or DB-backed job table, concurrency limit, stuck-`PROCESSING` reaper on startup, retry/backoff on embedding calls.
3. Batch/concurrency-limited embedding calls instead of sequential per-chunk await; cap max chunks/document.
4. Embedding failure handling: propagate failures so document flips to `FAILED`/`PARTIAL` instead of silently storing empty embeddings forever.
5. Global exception filter + structured `Logger` across all services (auth, chat, knowledge, agents) + request logging interceptor — currently only 2 files log anything, no consistent error shape.
6. Production Dockerfiles (multi-stage `npm ci` → build → slim runtime `CMD node dist/main.js` / `next start`) for `apps/api` and `apps/web`; current `Dockerfile.dev` + bind-mount + `npm install` + `prisma db push && seed` on every boot is dev-only. Switch non-local envs to `prisma migrate deploy`.
7. Frontend: split `workspace-shell.tsx` (1358 lines: chat state + SSE + optimistic messages + feedback + emoji + scroll, all in one component) into `useChatStream` hook + `MessageList` + `Composer`.
8. Frontend: collapse duplicate state — react-query cache in `layout.tsx` mirrored into a parallel Zustand store in `workspace-context.tsx` via a `sync()` effect. Pick one source of truth.
9. Auth token storage: access/refresh tokens in `localStorage` (XSS-readable) — migrate to httpOnly cookies set by backend, or add CSP as an interim compensating control.

### P1 / Simple — route to DeepSeek V4Flash (bounded, single-file, mechanical)
10. `memory.service.ts` dedup: fetch existing L1 memory set once per `extractFromConversation` call instead of re-querying + re-embedding per candidate inside the loop.
11. Wrap knowledge chunk delete+recreate (`reindexDocument`/`processDocument`) in `prisma.$transaction`, matching the existing pattern already used in `deleteDocument`.
12. Redact/truncate upstream error response bodies before they reach `this.logger.warn` in `embedding.service.ts` (currently logs raw `response.text()` which could echo back request headers).
13. Cron sweep for expired `RefreshToken` rows (`@nestjs/schedule`, once/day) — currently only deleted on rotation-use/logout, unbounded growth.
14. Add `@nestjs/throttler` globally with a sane default rate limit (auth + AI streaming endpoints currently unprotected).
15. Add `helmet()` middleware in `main.ts` — one line, no CSP/HSTS present today.
16. Frontend: delete `hasLegacyToken()` dead no-op branch in `auth.ts:174-183`; extract duplicated `resolveBody()` helper (`api.ts` + `sse.ts`) into shared `lib/http.ts`; factor `initialize()`'s duplicated try/catch/refresh/retry into one `restoreSession()` helper; consolidate scattered hardcoded provider-endpoint literals in `agents-page.tsx` into one `PROVIDER_DEFAULTS` map; add explicit `mermaid.initialize({ securityLevel: "strict" })` and `role="img"` on rendered diagram SVG.
17. Add at least one web smoke test for `lib/api.ts` 401→refresh→retry flow (web workspace currently reports 0 tests).
18. Remove unused `styled-components` dependency (confirmed dead — actual styling is CSS Modules + antd tokens) or actually adopt it; don't leave declared-but-unused.

### Explicitly deferred (documented, not scheduled)
- Sentry/error tracking — real cost, add only when there's an on-call rotation.
- CD/deploy pipeline — no target environment exists yet.
- Secrets manager/vault — local `.env` is fine for dev; production needs `NODE_ENV=production` + platform secret store, tracked as part of item 6.
