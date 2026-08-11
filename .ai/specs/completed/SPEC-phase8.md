---
status: done
phase: Phase 8
owner: PM
updated: 2026-08-01
---

# SPEC-Phase 8 — User System / Resource CRUD / Agent Ecosystem / Theme and Brand (Wade AI)

Version: 1.0(2026-08-01)

## 1. Goal

1. Users can be added/delete, roles USER ↔ ADMIN can be changed, and workspace OWNER can be transferred.
2. Resource CRUD is complete: workspace (rename/delete), member (existing), agents (create/delete), knowledge (rename).
3. Agent types are optional: ollama / openai-compatible / anthropic / openclaw / hermes; model configuration supports API Key (refer to cc-switch's default Provider experience).
4. Enable the Settings module: Account (change password)/Appearance (theme)/Workspace (change name, transfer to OWNER, delete)/User Management (global ADMIN).
5. Dark/light theme switching (optional according to the system).
6. Avatar drop-down menu: username/email + personal details + log out.
7. Input box `@All` is mentioned by all members (insert text + highlight display, MVP will not be pushed).
8. Renamed the brand to **Wade AI**: logo in the upper left corner, login page, browser tab (favicon + dynamic title changes with the module).

## 2. Roles and permissions

| OPERATIONS | GLOBAL ADMIN | OWNER | ADMIN(WORKSPACE) | MEMBER |
|------|:--:|:--:|:--:|:--:|
| User list/Change role/Delete (global) | ✅ | ❌ | ❌ | ❌ |
| Workspace rename/delete/transfer OWNER | ✅ | ✅ | ❌ | ❌ |
| Agents Create/Delete | ✅ | ✅ | ✅ | ❌ |
| Agents configuration modification | ✅ | ✅ | ✅ | ✅ |
| Knowledge document rename | ✅ | ✅ | ✅ | ✅ |
| Theme/Account(Change Password)/Personal Details | ✅ | ✅ | ✅ | ✅ |

Security constraints:
- Cannot delete/demote yourself; at least one ADMIN remains globally (demote/remove only ADMIN → 400).
- Transfer OWNER: The target must be a member of the workspace; after transfer, the original OWNER is automatically reduced to ADMIN.
- Delete Workspace cascade delete channels/messages/members/knowledge/memories/agents.

## 3. API contract (base path /api, all require JWT)

### User management (global ADMIN)
```
GET    /api/users?q=xxx         → [{id,name,email,role,createdAt}] (empty q returns all; limit 50)
PATCH  /api/users/:userId       {role: "USER"|"ADMIN"}   → updated user
DELETE /api/users/:userId       → {id}; cascade-deletes workspaceMember records
```

### Workspace
```
PATCH  /api/workspaces/:workspaceId   {name}                       → updated workspace (OWNER/global ADMIN)
POST   /api/workspaces/:workspaceId/transfer  {toUserId}           → {id} (OWNER only; target must be a member)
DELETE /api/workspaces/:workspaceId                                → {id} (OWNER only; cascade delete)
```

### Knowledge
```
PATCH  /api/knowledge/:documentId  {name}   → updated document
```

### Agents (typed + full CRUD)
```
GET    /api/workspaces/:workspaceId/agents   → [{id,name,type,engineType,isDefault,providerConfig:{baseUrl?,model?,hasApiKey}}]
POST   /api/workspaces/:workspaceId/agents   {name, type, providerConfig?}   → new agent (OWNER/ADMIN)
PATCH  /api/agents/:agentId                  {name?, providerConfig?}        → same response shape
DELETE /api/agents/:agentId                                                  → {id} (OWNER/ADMIN; default agent cannot be deleted → 400)
```
`type` enumeration: `OLLAMA | OPENAI_COMPATIBLE | ANTHROPIC | OPENCLAW | HERMES`.
- OPENCLAW / HERMES are processed by OPENAI_COMPATIBLE (OpenAI compatible endpoint), and the default baseUrl prompt is preset.
- ANTHROPIC takes the `/v1/messages` protocol (new AnthropicProvider).
- apiKey is only written, reading returns hasApiKey.

### Account
```
PATCH  /api/auth/password  {currentPassword, newPassword}   → {ok} (validates old password; minimum length 6)
```

### Document browsing (specs/skills, just log in as a member)
```
GET /api/docs/specs               → [{name, title}] (reads repository-root specs/*.md; title is the first # heading or filename)
GET /api/docs/specs/:name         → {name, content} (raw Markdown)
GET /api/docs/skills              → [{name, description}](skills/*.md frontmatter description)
GET /api/docs/skills/:name        → {name, content}
```
- Path location: `apps/api/src/docs` Use `path.resolve(__dirname, "../../..")` to get the warehouse root.
- Security: `:name` whitelist verification (only `[A-Za-z0-9_-]`), anti-path crossing; file does not exist → 404.

## 4. Implementation points

### Backend (apps/api)
- `users` module extension: list/patchRole/remove; `ensureGlobalAdmin(operatorId)`(role===ADMIN, otherwise 403); only ADMIN protection.
- `workspace.service`:updateWorkspace / transferOwnership / deleteWorkspace (transaction cascade deletion; transfer transaction: target member role=OWNER, original OWNER → ADMIN).
- `knowledge.service`:updateName。
- `agents`: schema plus `type` (default OPENAI_COMPATIBLE compatible stock); create/delete; delete the default agent rejection.
- AI runtime:
- Added `AnthropicProvider` (implementing AIProvider, `/v1/messages`, system/user/assistant conversion, reading `content_block_delta` SSE).
- `default-chat.engine` or provider factory selects provider according to agent.type (ANTHROPIC → AnthropicProvider, rest → OpenAICompatibleProvider); configuration injection follows the input.provider override mechanism.
- `auth.service`:changePassword。
- seed: keep admin@wade.local/admin; existing Agent record type default value (prisma: updateMany after push, add OLLAMA/OPENAI_COMPATIBLE).
- Single test: users (admin verification/unique admin protection), workspace (transfer/cascade deletion), agents (create/delete/default protection), anthropopic provider (message conversion).

### Front-end (apps/web)
- **Theme**:`theme/store.ts`(zustand persist:`light|dark|system`);`providers.tsx` ConfigProvider injects antd by theme `theme.darkAlgorithm/lightAlgorithm`;`globals.css` adds `:root[data-theme="dark"]` variable override (background #0f1420 system, surface #161c2b, text #e8ecf4, line #232b3d, the main color remains #024AD8);layout root node synchronization `document.documentElement.dataset.theme`;system mode listens to matchMedia.
- **Settings page** `app/(workspace)/settings/page.tsx` + `components/settings-page.tsx`:
- Account: Password change form (current password/new password).
- Appearance: Theme Radio (light/dark/following system).
- Workspace (OWNER/ADMIN globally visible): rename, transfer OWNER (Select + Popconfirm), delete (Popconfirm, cascade prompt).
- User management (only visible to global ADMIN): user form (name/email/role tag/registration time) + role switching (USER↔ADMIN, own row disabled) + delete (own row disabled) + top search.
- Enable the Settings of navigation `workspace-navigation.tsx` and change the label to "Settings".
- **Avatar drop-down menu** (`workspace-navigation.tsx` banner user button): Dropdown, header displays avatar + username + email, two menu items: personal details (Modal: avatar/email/role/registration time), log out (clear token and return to /login).
- **Agents page**: Add `type` selection to the configuration form (5 types, each type displays corresponding fields: ANTHROPIC/OPENAI_COMPATIBLE displays apiKey; default provider shortcut selection: OpenAI/DeepSeek/Ollama/Claude/OpenClaw/Hermes, select to automatically fill in baseUrl+model recommended value); add/delete agent button (default agent deletion is disabled); apiKey placeholder "Saved, leave blank to remain unchanged".
- **@All**:workspace-shell Suggestion mentionItems Add `{label:"All members", value:"@All", icon:<TeamOutlined/>}` at the top; `@All` is highlighted (purple Tag style) in message rendering.
- **Specs / Skills page** `app/(workspace)/specs/page.tsx` + `components/specs-page.tsx`, `app/(workspace)/skills/page.tsx` + `components/skills-page.tsx`: file list on the left (title/description) + markdown content on the right (react-markdown already exists); navigation menu by Lane B `workspace-navigation.tsx` adds Specs(icon FileTextOutlined)/Skills(icon BulbOutlined) entry.
- **Brand Wade AI**:
- `app/layout.tsx` title "Wade AI" + `app/icon.svg` (gradient blue background rounded square + white Z shape, main color #024AD8→#6a8dff gradient).
- "Wade AI" → "Wade AI" in `auth-page.tsx` and `workspace-navigation.tsx`, put the icon in the upper left corner.
- Dynamic tab title: `useEffect(() => { document.title = \`Wade AI · ${moduleLabel}\` }, [pathname])`(Chat=Workspace, Knowledge, Memory, Members, Agents, Settings) in `workspace-navigation`/layout.
- Login/registration page: Display icon + "Wade AI" at the top.

## 5. Task splitting (parallel lane)

- **Lane A (backend)** Full API (user/workspace/knowledge/agents/account/docs browsing) + AnthropicProvider + single test. File:`apps/api/src/{users,workspace,knowledge,agents,auth,ai,docs}`.
- **Lane B (front-end-basic)** Theme system + brand (favicon/logo/rename/tab title) + avatar drop-down menu + navigation menu items (enable Settings, add Specs/Skills entry). Files: `apps/web/src/{styles/globals.css,app/{layout.tsx,icon.svg,providers.tsx},components/{auth-page,workspace-navigation}.tsx,theme/store.ts}`.
- **Lane C (front-end-page)** Settings page + Agents default/CRUD UI + @All + Specs/Skills page. File: `apps/web/src/{app/(workspace)/{settings,specs,skills},components/{settings-page,agents-page,specs-page,skills-page}.tsx,components/workspace-shell.tsx}`.
- Dependencies: Lane A is predetermined by contract (this spec); B/C is implemented according to the contract, and joint debugging is in the QA Stage.

## 6. Acceptance

1. Passed all lint/typecheck/test (api, web).
2. e2e:
- admin login → Settings > User management: promote bob to ADMIN, then lower it back to USER, delete newly registered users; delete own/only ADMIN → 400 prompt.
- alice(OWNER)→ Settings > Workspace: Rename → Transfer OWNER to bob → Confirm that bob becomes OWNER and alice becomes ADMIN; delete a temporary workspace verification cascade.
- Agents: Create openclaw type agent → delete; default agent deletion is rejected; ANTHROPIC type hasApiKey=true after configuring apiKey.
- Theme: switch to dark color, the entire site (chat/each page/login page) will darken, refresh and maintain; follow the system to take effect.
- Avatar menu: Display username/email; personal details Modal; log out and log back to /login.
- Input box `@` → All members option, insert @All and send, highlighted in the message.
- Brand: The tab title changes with the module; the favicon is displayed; the login page and the upper left corner are the Wade AI icon.
3. AGENTS.md Change Log added.

## 7. Don’t do it (Follow-up)

- @All real push/notification center; multi-Agent parallel routing and Agent orchestration; user soft deletion and data retention policy; i18n (Chinese-English switching); avatar upload.
