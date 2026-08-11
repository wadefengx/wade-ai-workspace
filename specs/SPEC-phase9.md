# SPEC-Phase 9 — Session Experience / JWT Renewal / AIOS Organization Layer

Version: 1.0 (2026-08-01)

## 1. Goals

1. The sidebar can collapse/expand (collapsed state shows icons only).
2. Rename Channels to Chats: make them searchable and group them in reverse order of last activity (Today / Last Week / Last Month / specific month).
3. Add a light/dark theme quick-toggle button to the Header.
4. Persist login state: JWT access + refresh token pair, seamless frontend refresh, revocation on logout, re-login after expiration — permanently fix “full-page refresh loses login state”.
5. Refactor the repository into an **AI Native Repository (AIOS):** add the `.ai/` organization layer (Organization / Specification / Workflow / Knowledge / Runtime, with Memory / Skill / Harness across all layers) and rewrite `AGENTS.md` as a ≤200-line runtime entry point.

## 2. Authentication System (item 4)

### Contract
```
POST /api/auth/login    {email, password} → {accessToken, refreshToken, user}
POST /api/auth/refresh  {refreshToken}    → {accessToken, refreshToken} (rotation; old refresh is invalidated)
POST /api/auth/logout   (Bearer access)   → {ok} (revoke current refresh token)
```
- Access token: JWT, expires in 15 minutes; payload `{sub, email, role}`.
- Refresh token: random 32 bytes, expires in 30 days; store a hash in DB (`refreshTokens` collection: `{userId, tokenHash, expiresAt, createdAt}`); rotate on every refresh (delete old hash and store new hash).
- Revocation: logout removes every refresh token for that user; password change removes every refresh token.
- JWT validation failure (expired/invalid) returns 401; invalid/expired refresh returns 401 → frontend forces re-login.

### Frontend
- `stores/auth.ts`: persist `{accessToken, refreshToken, user}` in localStorage; `initialize()` recovery order: access exists → `/me`; 401 → call `/auth/refresh` with refresh → persist fresh tokens → `/me`; refresh failure → clear and return to `/login`.
- `lib/api.ts` `apiFetch`: on 401, attempt refresh (singleton lock; concurrent requests wait for refresh then replay); replay still 401 → logout. Every request includes `Authorization: Bearer ***`.
- Logout: call `/auth/logout` (revoke) + clear localStorage + return to `/login`.
- Backward-compatible migration for old token key `wade-ai-workspace-token`: when present, treat it as lacking refresh and go directly to login.

## 3. Sidebar and Chats (items 1/2)

### Collapse
- `workspace-navigation.tsx`: persist collapsed state (Zustand persist key `wade-ai-sidebar-collapsed`); when collapsed, use 64px width and show icons only (simplified Workspace Select, channel icons, menu icons); when expanded, restore 280px width; brand area shows compact logo.

### Chats
- API: extend `GET /api/workspaces/:workspaceId/channels` results with `lastMessageAt` (time of channel’s latest message; `null` when none) + optional `messageCount`.
- Frontend: rename the left list to Chats; add a top search box (filter channel names); group by `lastMessageAt` relative to now: Today (same date), Last Week (within 7 days), Last Month (within 30 days), older items grouped as `YYYY-MM`; sort within groups descending; show group headings; place channels with no messages in a “No messages yet” group or leave them ungrouped at the end.

## 4. Header Theme Button (item 3)

- Add a theme-toggle icon button to the `workspace-navigation.tsx` banner/header (Tooltip “Toggle theme”): click switches between light/dark (writes to the theme store); when current mode is system, display the resolved system value.

## 5. AIOS Organization Layer (item 5)

### Directory Layout (repository root `.ai/`)
```
.ai/
├── AGENTS.md (replacement entry for repository-root AGENTS.md, ≤200 lines)
├── organization/{constitution,team,routing,communication}.md + roles/{pm,architect,frontend,backend,qa,ux,devops}.md
├── runtime/{context-loading,model-routing,prompt-policy,tool-policy,coding-policy,context-priority}.md
├── workflows/{feature,bugfix,refactor,release,architecture,research}.md
├── specs/{TEMPLATE.md,active/,completed/,archived/}
├── skills/{common/,frontend/,backend/,architecture/,testing/,documentation/,ai/,devops/}
├── memory/{project,architecture,glossary,decisions,lessons,conventions,known-issues}.md
├── knowledge/{business/,product/,engineering/,framework/,references/}
├── architecture/{overview,tech-stack,modules,folder-structure,api-contract}.md + adr/{ADR-001..005}.md
├── harness/{evals/,fixtures/,benchmark/,regression/,prompts/,scorecards/}
├── templates/
└── changelog/
```
- Migration: `specs/SPEC-*.md` → `.ai/specs/completed/`; `skills/{ponytail,sdd-workflow}.md` → `.ai/skills/common/`; update the docs service to read `.ai/specs/` and `.ai/skills/` while retaining backward compatibility with old paths.
- Rewrite `AGENTS.md` to contain only Mission / Context loading order / AI lifecycle / global engineering rules / directory index / references; move body content into `.ai/` files.
- Five core object models (document in `.ai/organization/constitution.md`):
  - Organization (how AI collaborates) → Specification (what to build) → Workflow (how to do it) → Knowledge (what it knows) → Runtime (how it executes); Memory / Skill / Harness are systems that span the lifecycle.
- ADR-001–005: AI Native / Local First / MongoDB / Prisma / SDD.

## 6. Task Breakdown (parallel lanes)

- **Lane A (backend):** refresh-token system (schema/auth service/controller + unit tests) + `channels.lastMessageAt` aggregation + docs-service `.ai` paths + Swagger annotations.
- **Lane B (frontend):** seamless `apiFetch` refresh + auth-store recovery + sidebar collapse + Chats search/grouping + Header theme button + logout revocation.
- **Lane C (AIOS):** complete `.ai/` directory and docs (organization/runtime/workflows/memory/knowledge/architecture/ADR/harness) + `AGENTS.md` rewrite + Specs/Skills migration.
- Contract: A defines auth endpoints first and B implements against them; C’s docs paths overlap with A’s docs-service change — C migrates files only, A changes service read paths only; this spec fixes dual-path compatibility.

## 7. Acceptance

1. Lint/typecheck/tests (API and web) all pass.
2. E2E:
   - Login → refresh page and remain signed in (do not return to login); expired access (shorten it in test) refreshes seamlessly; refresh is invalid after logout (calling `/auth/refresh` with the old refresh → 401).
   - Sidebar collapse/expand persists through refresh; Chats search filters; channels display grouped by time (Today/Last Week/month).
   - Header theme button switches light↔dark immediately and persists.
   - `.ai/` directory structure is complete; `AGENTS.md` ≤200 lines; docs page can list `.ai/specs` and `.ai/skills` files.
3. Append to the `AGENTS.md` Change Log.

## 8. Out of Scope (later)

- Multi-device session management (device list/remote single-device logout); refresh-token fingerprinting (device/IP); OAuth/SSO; manual pinning of chat groups; full-text search within messages.
