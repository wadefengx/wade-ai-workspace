---
status: done
phase: Phase 9
owner: PM
updated: 2026-08-01
---

# SPEC-Phase 9 — Conversation Experience / JWT Renewal / AIOS Organization Layer

Version: 1.0 (2026-08-01)

## 1. Goals

1. The sidebar can collapse/expand (only icons are shown when collapsed).
2. Rename Channels to Chats: searchable and grouped in reverse chronological order by most recent activity (Today / Previous Week / Previous Month / specific month).
3. Add a quick light/dark theme-toggle button to the Header.
4. Persist login state: JWT access + refresh dual tokens, transparent frontend refresh, revocable on sign-out, and re-login after expiration—eliminating "losing login state after a full-page refresh."
5. Refactor the repository into an **AI Native Repository (AIOS)**: a `.ai/` organization layer (Organization / Specification / Workflow / Knowledge / Runtime with Memory / Skill / Harness running through it), and rewrite AGENTS.md as a runtime entry point of no more than 200 lines.

## 2. Authentication System (item 4)

### Contract
```
POST /api/auth/login    {email, password} → {accessToken, refreshToken, user}
POST /api/auth/refresh  {refreshToken}    → {accessToken, refreshToken} (rotation; old refresh is invalidated)
POST /api/auth/logout   (Bearer access)   → {ok} (revoke current refresh token)
```
- Access token: JWT, expires in 15 minutes, payload `{sub, email, role}`.
- Refresh token: random 32 bytes, expires in 30 days; store a hash in DB (`refreshTokens` collection: `{userId, tokenHash, expiresAt, createdAt}`); rotate on every refresh (delete old hash, write new hash).
- Revocation: logout deletes all refresh tokens for the user; changing password deletes all refresh tokens.
- JWT validation failure (expired/invalid) returns 401; invalid/expired refresh returns 401 → frontend forces re-login.

### Frontend
- `stores/auth.ts`: localStorage stores `{accessToken, refreshToken, user}`; `initialize()` recovery order: access exists → `/me`; 401 → use refresh to call `/auth/refresh` → persist new token → `/me`; refresh failure → clear and return to `/login`.
- `lib/api.ts` apiFetch: on 401, attempt refresh (singleton lock; concurrent requests queue until refresh completes, then replay); if replay remains 401 → sign out. All requests include `Authorization: Bearer ***`.
- Sign out: call `/auth/logout` (revoke) + clear localStorage + return to `/login`.
- Backward-compatible migration for old token key `wade-ai-workspace-token`: when found, treat refresh as missing and go directly to login.

## 3. Sidebar and Chats (items 1/2)

### Collapse
- `workspace-navigation.tsx`: persist collapse state (zustand persist key `wade-ai-sidebar-collapsed`); collapsed width is 64px and shows only icons (simplified workspace Select, channel icons, menu icons); expanded width returns to 280px; show a compact logo in the brand area.

### Chats
- API: `GET /api/workspaces/:workspaceId/channels` response adds `lastMessageAt` (time of the most recent message in the channel; null if no messages) + optional `messageCount`.
- Frontend: rename the left list to Chats; add a top search field (filters channel names); group by `lastMessageAt` relative to now: Today (same day), Previous Week (within 7 days), Previous Month (within 30 days), and earlier by `YYYY-MM`; descending order within each group; show group labels; channels without messages go in a "No Messages Yet" group or are ungrouped (at the end).

## 4. Header Theme Button (item 3)

- Add a theme-toggle icon button to the `workspace-navigation.tsx` banner/top (Tooltip: "Switch theme"): click to toggle light/dark (write to theme store); when current mode is system, display the system-resolved value.

## 5. AIOS Organization Layer (item 5)

### Directory Layout (repository-root `.ai/`)
```
.ai/
├── AGENTS.md (→ replacement entry point for repository-root AGENTS.md, ≤200 lines)
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
- Migration: `specs/SPEC-*.md` → `.ai/specs/completed/`; `skills/{ponytail,sdd-workflow}.md` → `.ai/skills/common/`; update docs-service read paths to `.ai/specs/` and `.ai/skills/` (backward compatible with legacy paths).
- Rewrite AGENTS.md to contain only Mission / Context loading order / AI lifecycle / global engineering rules / directory index / references; move body content into files under `.ai/`.
- Five-object model (write to `.ai/organization/constitution.md`):
  - Organization (how AI collaborates) → Specification (what to do) → Workflow (how to do it) → Knowledge (what it knows) → Runtime (how it executes); Memory / Skill / Harness are systems that span the lifecycle.
- ADR-001~005: AI Native / Local First / MongoDB / Prisma / SDD.

## 6. Task Breakdown (parallel lanes)

- **Lane A (backend)**: refresh-token system (schema/auth service/controller + unit tests) + channels `lastMessageAt` aggregation + docs-service `.ai` paths + Swagger annotations.
- **Lane B (frontend)**: transparent apiFetch refresh + auth-store recovery + sidebar collapse + Chats search/grouping + header theme button + sign-out revocation.
- **Lane C (AIOS)**: full `.ai/` directories and documentation (organization/runtime/workflows/memory/knowledge/architecture/ADR/harness) + AGENTS.md rewrite + specs/skills migration.
- Contract: A defines auth endpoints first; B implements against the contract; C's docs paths overlap A's docs-service changes—C migrates files only, A changes only the service read logic, and the spec fixes dual-path compatibility.

## 7. Acceptance

1. lint/typecheck/test (api, web) all pass.
2. e2e:
   - Sign in → page refresh retains login state (does not return to login); expired access (shorten in test) automatically refreshes transparently; after logout, refresh is invalid (old refresh calling `/auth/refresh` → 401).
   - Sidebar collapse/expand persists after refresh; Chats search filters; channels are grouped by time (Today/Previous Week/month).
   - Header theme button instantly switches light↔dark and persists.
   - The `.ai/` directory structure is complete; AGENTS.md has ≤200 lines; the docs page lists `.ai/specs` and `.ai/skills` files.
3. Append to the AGENTS.md Change Log.

## 8. Exclusions (Later)

- Multi-device session management (device list/sign out a single device); refresh-token fingerprinting (device/IP); OAuth/SSO; manually pinning chat groups; full-text search within messages.
