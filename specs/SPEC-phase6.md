# SPEC-Phase 6 — Member and Permission Management + Agent Model Configuration

Version: 1.0 (2026-08-01)

## 1. Goals

1. Team member management: add/remove members and manage roles (`OWNER > ADMIN > MEMBER`); add a Members entry to the left navigation.
2. Agent model configuration: enable the left-side Agents entry; support configuring the default Chat Agent Provider (local Ollama / OpenAI-compatible remote); configuration takes effect immediately.
3. Memory/Knowledge already have CRUD. This phase only completes integration (member changes affect memory-visibility checks) and adds no new functionality.

## 2. Role Model

| Role | Description | Member management | Model configuration |
|------|-------------|-------------------|---------------------|
| OWNER | Workspace creator; the sole role that cannot be removed or demoted | ✅ (including changing ADMIN role) | ✅ |
| ADMIN | Administrator | ✅ (cannot operate on OWNER) | ✅ |
| MEMBER | Ordinary member | ❌ | ✅ |

- Each Workspace must retain at least one OWNER (removing/demoting the last OWNER returns 400).
- New members cannot be granted OWNER directly.
- Schema: add `ADMIN` to the `WorkspaceRole` enum (`apps/api/prisma/schema.prisma`); effective after DB push.

## 3. API Contract (base path `/api`)

### Member management

```
GET    /api/users/search?q=xxx            # Search users by email/name prefix (authenticated users), limit 10; returns [{id,name,email}]
POST   /api/workspaces/:workspaceId/members   # {email, role?: MEMBER|ADMIN}; OWNER/ADMIN only
PATCH  /api/members/:memberId             # {role: MEMBER|ADMIN}; OWNER/ADMIN only; OWNER target → 403; last OWNER → 400
DELETE /api/members/:memberId             # OWNER/ADMIN only; OWNER → 403; last OWNER → 400
```

- Adding an existing member → 409; unregistered email → 404.
- Errors: `{statusCode, message}` (Chinese).

### Agent configuration

```
GET   /api/workspaces/:workspaceId/agents   # [{id,name,engineType,providerConfig:{baseUrl,model,hasApiKey}}]
PATCH /api/agents/:agentId                  # {name?, providerConfig?: {baseUrl?, apiKey?, model?}}
```

- `apiKey` is write-only; reads return only `hasApiKey`.
- Runtime priority: DB `providerConfig` > environment variables (`AI_PROVIDER_*` / `OLLAMA_*`).

## 4. Implementation Details

### API

- Add `addMember` / `updateMemberRole` / `removeMember` to `workspace.service.ts`; reuse `ensureManager(workspaceId, userId)` (OWNER/ADMIN check) and `ensureOwnerExists` (last-OWNER protection); leave `WorkspaceMemberGuard` unchanged.
- Add a `users` module with a search endpoint using `prisma.user.findMany({where: {OR: [{email contains q}, {name contains q}]}})` case-insensitively.
- Add an `agents` module: CRUD against the existing `Agent` table using JSON `providerConfigRef`.
- AI configuration injection (minimal intrusion): add optional `provider?: {baseUrl?, apiKey?, model?}` to `AIProviderStreamInput`; consolidate four environment reads in `OpenAICompatibleProvider` into `resolveConfig(input)` (input takes precedence); make `DefaultChatEngine.stream` retrieve the current Workspace default Agent’s `providerConfigRef` and pass it in.

### Web

- `workspace-page-frame.tsx` `navItems`: enable `agents`, add `members` (`TeamOutlined`), and keep `settings` disabled.
- Add `app/members/page.tsx` + `components/members-page.tsx`:
  - Member table: avatar (initial), name, email, role Tag (OWNER gold / ADMIN blue / MEMBER gray), joined time, actions.
  - Add-member Modal: email search (`Select showSearch` + remote `/users/search`) + role selection (MEMBER/ADMIN).
  - Role-change Select (disabled for OWNER row) and remove Popconfirm (disabled for OWNER row).
  - Only the current OWNER/ADMIN sees management actions; non-managers are read-only.
- Add `app/agents/page.tsx` + `components/agents-page.tsx`:
  - Default-Agent card: name / `engineType` / capability description.
  - Configuration form: Provider type (`ollama | openai-compatible`) → `baseUrl`, `model`, `apiKey` (placeholder: “Saved; leave empty to keep unchanged”), Save.
  - Success message + query invalidation after saving.
- Reuse `workspace-page-frame.tsx` + `unwrapItems` on new pages.

## 5. Acceptance

1. `npm run lint/typecheck/test --workspace=@wade/api` and web all pass.
2. Browser e2e:
   - Alice (OWNER) enters Members → searches and adds Bob as MEMBER → Bob logs in and can see the Workspace (can chat but cannot manage members) → Alice promotes Bob to ADMIN → Bob can manage members (add Carol) → Alice removes Carol.
   - Role-change and remove controls are disabled on the OWNER row; removing OWNER returns a 403 prompt.
   - Agents page: change the default Agent model to `qwen3:8b` (Ollama) and save → `@AI` streaming still works; after saving a remote provider (`baseUrl`/`model`/`apiKey`), list shows `hasApiKey`.
3. Update the `AGENTS.md` Change Log.

## 6. Out of Scope (later)

- Member invitation links / join-on-registration; multiple Agent engines (Planner/Tool); Agent Marketplace; Settings page (enterprise configuration).
