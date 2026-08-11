---
status: done
phase: Phase 6
owner: PM
updated: 2026-08-01
---

# SPEC-Phase 6 — Member and Permission Management + Agent Model Configuration

Version: 1.0 (2026-08-01)

## 1. Goals

1. Team member management: add/remove members and manage roles (OWNER > ADMIN > MEMBER); add a Members entry to the left menu.
2. Agent model configuration: enable the left-side Agents entry, support configuring the default Chat Agent provider (local Ollama / OpenAI-compatible remote), and apply configuration changes immediately.
3. Memory/Knowledge CRUD already exists; this stage only completes integration (member changes affect memory-visibility checks) and adds no new features.

## 2. Role Model

| Role | Description | Member Management | Model Configuration |
|------|------|----------|----------|
| OWNER | Workspace creator; the only role that cannot be removed or demoted | ✅ (including changing ADMIN roles) | ✅ |
| ADMIN | Administrator | ✅ (cannot operate on OWNER) | ✅ |
| MEMBER | Regular member | ❌ | ✅ |

- Each workspace retains at least one OWNER (removing/demoting the last OWNER returns 400).
- OWNER cannot be granted directly when adding a member.
- Schema: add `ADMIN` to the `WorkspaceRole` enum (`apps/api/prisma/schema.prisma`); applied via db push.

## 3. API Contract (base path: `/api`)

### Member Management

```
GET    /api/users/search?q=xxx            # Search users by email/name prefix (any logged-in user), limit 10, returns [{id,name,email}]
POST   /api/workspaces/:workspaceId/members   # {email, role?: MEMBER|ADMIN}; OWNER/ADMIN only
PATCH  /api/members/:memberId             # {role: MEMBER|ADMIN}; OWNER/ADMIN only; OWNER target → 403, last OWNER → 400
DELETE /api/members/:memberId             # OWNER/ADMIN only; OWNER → 403, last OWNER → 400
```

- Adding an existing member → 409; unregistered email → 404.
- Errors: `{statusCode, message}` (Chinese).

### Agent Configuration

```
GET   /api/workspaces/:workspaceId/agents   # [{id,name,engineType,providerConfig:{baseUrl,model,hasApiKey}}]
PATCH /api/agents/:agentId                  # {name?, providerConfig?: {baseUrl?, apiKey?, model?}}
```

- `apiKey` is write-only; reads return only `hasApiKey`.
- Runtime precedence: DB providerConfig > environment variables (`AI_PROVIDER_*` / `OLLAMA_*`).

## 4. Implementation Details

### API

- Add `addMember / updateMemberRole / removeMember` to `workspace.service.ts`; share `ensureManager(workspaceId, userId)` (OWNER/ADMIN validation) and `ensureOwnerExists` (last-OWNER protection); leave `WorkspaceMemberGuard` unchanged.
- Add a `users` module (search endpoint using `prisma.user.findMany({where: {OR: [{email contains q}, {name contains q}]}})`, case-insensitive).
- Add an `agents` module: CRUD on the existing `Agent` table with `providerConfigRef` JSON.
- AI configuration injection (minimal intrusion): add optional `provider?: {baseUrl?, apiKey?, model?}` to `AIProviderStreamInput`; consolidate four env reads in `OpenAICompatibleProvider` into `resolveConfig(input)` (input takes precedence); have `DefaultChatEngine.stream` look up and pass the current workspace default agent's `providerConfigRef` first.

### Web

- `workspace-page-frame.tsx` navItems: enable `agents`, add `members` (icon `TeamOutlined`), and keep `settings` disabled.
- Add `app/members/page.tsx` + `components/members-page.tsx`:
  - Member table: avatar (initial)/name/email/role Tag (OWNER gold/ADMIN blue/MEMBER gray)/join time/actions.
  - Add-member modal: email search (`Select showSearch` + remote search `/users/search`) + role selection (MEMBER/ADMIN).
  - Role-switch `Select` (disabled for OWNER row) and remove `Popconfirm` (disabled for OWNER row).
  - Show management actions only to the current OWNER/ADMIN; non-management roles are read-only.
- Add `app/agents/page.tsx` + `components/agents-page.tsx`:
  - Default Agent card: name/engineType/capability description.
  - Configuration form: provider type (`ollama | openai-compatible`) → baseUrl, model, apiKey (placeholder: "Saved; leave blank to keep unchanged"), save.
  - Show a success message and invalidate the query after save.
- Reuse `workspace-page-frame.tsx` + `unwrapItems` for new pages.

## 5. Acceptance

1. `npm run lint/typecheck/test --workspace=@wade/api` and web all pass.
2. Browser e2e:
   - alice (OWNER) enters Members → searches for and adds bob as MEMBER → bob signs in and can see the workspace (can chat but cannot manage members) → alice promotes bob to ADMIN → bob can manage members (adds carol) → alice removes carol.
   - Role switching and remove buttons are disabled for the OWNER row; attempting to remove OWNER returns a 403 prompt.
   - Agents page: change the default Agent model to `qwen3:8b` (Ollama) and save → @AI streaming still works; after saving a remote provider (baseUrl/model/apiKey), the list shows `hasApiKey`.
3. Update the AGENTS.md Change Log.

## 6. Exclusions (Later)

- Member invitation links, joining upon registration; multiple Agent engines (Planner/Tool); Agent Marketplace; Settings page (enterprise configuration).
