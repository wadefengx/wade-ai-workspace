# SPEC-Phase 8 — User System / Resource CRUD / Agent Ecosystem / Theme and Brand (Wade AI)

Version: 1.0 (2026-08-01)

## 1. Goals

1. Users can be added/deleted; roles can change between USER ↔ ADMIN; Workspace ownership can be transferred.
2. Complete resource CRUD: Workspace (rename/delete), member (existing), Agents (create/delete), Knowledge (rename).
3. Selectable Agent types: `ollama` / `openai-compatible` / `anthropic` / `openclaw` / `hermes`; model configuration supports API keys (following cc-switch preset-Provider UX).
4. Enable Settings: account (change password) / appearance (theme) / Workspace (rename, transfer OWNER, delete) / user management (global ADMIN).
5. Dark/light theme switching (optional system-following mode).
6. Avatar dropdown: user name/email + personal profile + logout.
7. `@All` all-member mention in the input (insert text + highlighted display; MVP has no notifications).
8. Rename the brand to **Wade AI**: top-left logo, login page, browser tab (favicon + dynamic title changing by module).

## 2. Roles and Permissions

| Action | Global ADMIN | OWNER | ADMIN (Workspace) | MEMBER |
|------|:--:|:--:|:--:|:--:|
| List users / change role / delete (global) | ✅ | ❌ | ❌ | ❌ |
| Rename/delete Workspace / transfer OWNER | ✅ | ✅ | ❌ | ❌ |
| Create/delete Agents | ✅ | ✅ | ✅ | ❌ |
| Modify Agent configuration | ✅ | ✅ | ✅ | ✅ |
| Rename Knowledge document | ✅ | ✅ | ✅ | ✅ |
| Theme/account (change password)/personal profile | ✅ | ✅ | ✅ | ✅ |

Security constraints:
- Users cannot delete/demote themselves; retain at least one global ADMIN (demoting/deleting the sole ADMIN → 400).
- Owner transfer: target must be a Workspace member; after transfer, the former OWNER is automatically demoted to ADMIN.
- Deleting a Workspace cascades to channels/messages/members/knowledge/memories/agents.

## 3. API Contract (base path `/api`; all require JWT)

### User management (global ADMIN)
```
GET    /api/users?q=xxx         → [{id,name,email,role,createdAt}] (empty q returns all; limit 50)
PATCH  /api/users/:userId       {role: "USER"|"ADMIN"}   → updated user
DELETE /api/users/:userId       → {id}; cascade-delete its workspaceMember records
```

### Workspace
```
PATCH  /api/workspaces/:workspaceId   {name}                       → updated Workspace (OWNER/global ADMIN)
POST   /api/workspaces/:workspaceId/transfer  {toUserId}           → {id} (OWNER only; target must be a member)
DELETE /api/workspaces/:workspaceId                                → {id} (OWNER only; cascade delete)
```

### Knowledge
```
PATCH  /api/knowledge/:documentId  {name}   → updated document
```

### Agents (typed + complete CRUD)
```
GET    /api/workspaces/:workspaceId/agents   → [{id,name,type,engineType,isDefault,providerConfig:{baseUrl?,model?,hasApiKey}}]
POST   /api/workspaces/:workspaceId/agents   {name, type, providerConfig?}   → new Agent (OWNER/ADMIN)
PATCH  /api/agents/:agentId                  {name?, providerConfig?}        → same structure
DELETE /api/agents/:agentId                                                  → {id} (OWNER/ADMIN; default Agent cannot be deleted → 400)
```
`type` enum: `OLLAMA | OPENAI_COMPATIBLE | ANTHROPIC | OPENCLAW | HERMES`.
- Treat OPENCLAW / HERMES as OPENAI_COMPATIBLE (OpenAI-compatible endpoint); show suggested preset `baseUrl`.
- ANTHROPIC uses the `/v1/messages` protocol (new `AnthropicProvider`).
- `apiKey` is write-only; reads return `hasApiKey`.

### Account
```
PATCH  /api/auth/password  {currentPassword, newPassword}   → {ok} (validate old password; length ≥ 6)
```

### Document browser (Specs / Skills; any signed-in member)
```
GET /api/docs/specs               → [{name, title}] (read repo-root specs/*.md; title is first # line or filename)
GET /api/docs/specs/:name         → {name, content} (raw Markdown)
GET /api/docs/skills              → [{name, description}] (skills/*.md frontmatter description)
GET /api/docs/skills/:name        → {name, content}
```
- Path resolution: `apps/api/src/docs` uses `path.resolve(__dirname, "../../..")` to reach repository root.
- Security: validate `:name` against the `[A-Za-z0-9_-]` allowlist to prevent path traversal; nonexistent files → 404.

## 4. Implementation Details

### Backend (`apps/api`)
- Extend the `users` module: list/patchRole/remove; `ensureGlobalAdmin(operatorId)` (`role===ADMIN`, otherwise 403); sole-ADMIN protection.
- `workspace.service`: `updateWorkspace` / `transferOwnership` / `deleteWorkspace` (transactional cascade deletion; transfer transaction: target-member role=OWNER, former OWNER → ADMIN).
- `knowledge.service`: `updateName`.
- `agents`: add schema `type` (default `OPENAI_COMPATIBLE` for existing data); create/delete; reject deletion of the default Agent.
- AI runtime:
  - Add `AnthropicProvider` (implements `AIProvider`, calls `/v1/messages`, converts system/user/assistant messages, reads `content_block_delta` SSE).
  - Let `default-chat.engine` or the provider factory select by `agent.type` (ANTHROPIC → `AnthropicProvider`; all others → `OpenAICompatibleProvider`); retain `input.provider` override injection.
- `auth.service`: `changePassword`.
- Seed: retain `admin@wade.local/admin`; after `prisma:push`, backfill existing Agent records with default types (`OLLAMA`/`OPENAI_COMPATIBLE`).
- Unit tests: users (admin authorization/sole-admin protection), Workspace (transfer/cascade deletion), Agents (create/delete/default protection), Anthropic provider (message conversion).

### Frontend (`apps/web`)
- **Theme:** `theme/store.ts` (Zustand persistence: `light|dark|system`); use `ConfigProvider` in `providers.tsx` to inject Ant Design `theme.darkAlgorithm/lightAlgorithm`; add `:root[data-theme="dark"]` variable overrides in `globals.css` (background `#0f1420`, surface `#161c2b`, text `#e8ecf4`, line `#232b3d`, retain primary `#024AD8`); synchronize `document.documentElement.dataset.theme` in root layout; watch `matchMedia` in system mode.
- **Settings page** — `app/(workspace)/settings/page.tsx` + `components/settings-page.tsx`:
  - Account: change-password form (current/new password).
  - Appearance: theme Radio (light/dark/follow system).
  - Workspace (visible to OWNER/global ADMIN): rename, transfer OWNER (member Select + Popconfirm), delete (Popconfirm with cascade warning).
  - User management (only global ADMIN): table (name/email/role Tag/registration time) + role switch (disable own row) + delete (disable own row) + top search.
  - Enable Settings in `workspace-navigation.tsx`, with label “Settings”.
- **Avatar dropdown** (`workspace-navigation.tsx` banner user button): Dropdown header with avatar + username + email; menu entries: personal profile (Modal: avatar/email/role/registration time) and logout (clear token and return to `/login`).
- **Agents page:** add `type` selection (five types, each showing appropriate fields; quick preset selection for OpenAI/DeepSeek/Ollama/Claude/OpenClaw/Hermes that fills suggested `baseUrl`+model); create/delete Agent controls (default Agent delete disabled); API-key placeholder “Saved; leave empty to keep unchanged”.
- **`@All`:** add `{label:"All members", value:"@All", icon:<TeamOutlined/>}` at the top of `workspace-shell` `mentionItems`; highlight `@All` in messages with a purple Tag-style treatment.
- **Specs / Skills pages:** `app/(workspace)/specs/page.tsx` + `components/specs-page.tsx`, `app/(workspace)/skills/page.tsx` + `components/skills-page.tsx`: left file list (title/description) + right Markdown content (`react-markdown` already exists); Lane B adds Specs (`FileTextOutlined`) / Skills (`BulbOutlined`) entries to `workspace-navigation.tsx`.
- **Wade AI brand:**
  - `app/layout.tsx` title “Wade AI” + `app/icon.svg` (blue-gradient rounded square with a white Z shape; `#024AD8→#6a8dff`).
  - Keep “Wade AI” in `auth-page.tsx` and `workspace-navigation.tsx`; add icon at top left.
  - Dynamic tab title: in `workspace-navigation`/layout, `useEffect(() => { document.title = \`Wade AI · ${moduleLabel}\` }, [pathname])` (chat=Workspace, Knowledge, Memory, Members, Agents, Settings).
  - Login/register page: show icon + “Wade AI” at top.

## 5. Task Breakdown (parallel lanes)

- **Lane A (backend):** all APIs (users/Workspace/Knowledge/Agents/account/docs browser) + `AnthropicProvider` + unit tests. Files: `apps/api/src/{users,workspace,knowledge,agents,auth,ai,docs}`.
- **Lane B (frontend — foundation):** theme system + branding (favicon/logo/rename/tab title) + avatar dropdown + navigation entries (enable Settings and add Specs/Skills). Files: `apps/web/src/{styles/globals.css,app/{layout.tsx,icon.svg,providers.tsx},components/{auth-page,workspace-navigation}.tsx,theme/store.ts}`.
- **Lane C (frontend — pages):** Settings page + Agent presets/CRUD UI + `@All` + Specs/Skills pages. Files: `apps/web/src/{app/(workspace)/{settings,specs,skills},components/{settings-page,agents-page,specs-page,skills-page}.tsx,components/workspace-shell.tsx}`.
- Dependency: Lane A defines contracts first; B/C implement against them; integration happens during QA.

## 6. Acceptance

1. Lint/typecheck/tests (API and web) all pass.
2. E2E:
   - Admin logs in → Settings > User Management: promote Bob to ADMIN, demote him to USER, delete a newly registered user; deleting self/sole ADMIN → 400 prompt.
   - Alice (OWNER) → Settings > Workspace: rename → transfer OWNER to Bob → verify Bob becomes OWNER and Alice becomes ADMIN; delete a temporary Workspace to verify cascading.
   - Agents: create then delete an OpenClaw Agent; default-Agent deletion is rejected; configure an ANTHROPIC Agent with an `apiKey` and verify `hasApiKey=true`.
   - Theme: switch to dark; the whole site (chat/every page/login) darkens and survives refresh; system-following works.
   - Avatar menu: shows username/email; personal-profile Modal; logout returns to `/login`.
   - Input `@` → All members option, insert and send `@All`, and it appears highlighted in the message.
   - Brand: tab title changes with module; favicon is displayed; login page and top left show Wade AI icon.
3. Append to the `AGENTS.md` Change Log.

## 7. Out of Scope (later)

- Real `@All` notification center; concurrent multi-Agent routing and Agent orchestration; user soft deletion/data-retention policy; i18n (Chinese/English switching); avatar upload.
