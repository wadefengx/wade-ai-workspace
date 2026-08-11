# API Contract (Current)

Base path: `/api` (NestJS global prefix). Requests and responses use JSON; timestamps use ISO 8601 UTC; IDs are MongoDB ObjectIds. For the complete OpenAPI definition, see [Swagger UI](http://localhost:3001/api/swagger).

Authentication: registration and login return an `accessToken` (Bearer); `/auth/refresh` rotates tokens. All endpoints except health checks, registration, and login require `Authorization: Bearer ***`.

## Authentication `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | /auth/register | `{email, password, name?}` → 201 |
| POST | /auth/login | `{email, password}` → `{accessToken, user}` |
| POST | /auth/refresh | `{refreshToken}` → a new token pair |
| POST | /auth/logout | Invalidates the current refresh token |
| GET | /auth/me | Current user information |
| PATCH | /auth/password | `{oldPassword, newPassword}` |

## Workspaces `/api/workspaces` (requires `WorkspaceMember` permission)

- `GET /`, `POST /` (create a workspace), `GET /:id`, `PATCH /:id`, `DELETE /:id`
- `GET /:id/channels`, `POST /:id/channels` (create a channel)
- `GET /:id/members`, `POST /:id/members`, `PATCH /members/:memberId`, `DELETE /members/:memberId`
- Workspace responses include **defaultAgentId** (Phase 16: the default agent for conversations).

## Chat `/api/channels`

| Method | Path | Description |
|---|---|---|
| GET | /channels/:id/messages | Message history (cursor pagination) |
| POST | /channels/:id/messages | `{content, mentionIds?}` → 201 message |
| PATCH | /channels/:id/messages/:msgId/feedback | `{feedback: like\|dislike\|null}` |
| POST | /channels/:id/generate-title | Generate a conversation title with AI |
| POST | /channels/:id/ai/stream | **SSE-streamed AI response** |

**SSE events** (`stream`): `token {content}` / `citations {citations: [{index, filename, chunkIndex, content}]}` / `reasoning` / `done` / `error {message}`.

## Agents `/api` (Phases 14–16)

- `GET /workspaces/:id/agents`, `POST /workspaces/:id/agents`, `PATCH /agents/:id`, `DELETE /agents/:id`
- `POST /agents/:id/test` — **test the connection** (calls the provider to validate `baseUrl`, key, and model)
- Agent fields: `name`, `type` (`OLLAMA`/`OPENAI_COMPATIBLE`/`ANTHROPIC`/`OPENCLAW`/`HERMES`), `engineType`, `emoji`, `role`, `description`, `systemPrompt`, `harness`, `providerConfigRef` (write-only; responses expose `hasApiKey`), `embeddingModel`, and `embeddingBaseUrl`

## Knowledge (RAG) `/api`

- `POST /workspaces/:id/knowledge` (upload a document; multipart)
- `GET /workspaces/:id/knowledge`, `PATCH /knowledge/:docId`, `DELETE /knowledge/:docId`
- `POST /knowledge/:docId/reindex` (re-chunk; skips when `contentHash` is unchanged)

## Memory (Phase 16 layered memory) `/api`

- `GET /workspaces/:id/memories`, `POST /workspaces/:id/memories` (create manually)
- `PATCH /memories/:id`, `DELETE /memories/:id`
- **`POST /channels/:id/memories/extract`** — extracts L1 atoms → L2 scenarios from a channel conversation (LLM JSON; degrades to `{success:false}` on failure)

## Docs / Stats / Users

- `GET /docs/specs`, `GET /docs/specs/:name`, `GET /docs/skills`, `GET /docs/skills/:name` (browse SDD specifications and skills)
- `GET /stats/organization` (AI organization dashboard), `GET /stats/feedback`
- `GET /users` (user management; global administrators only)

## Health Check

- `GET /api/health` → `{status: "ok"}` (DB ping only; Ollama is optional and does not affect health)

## Error Format

```json
{ "statusCode": 400, "message": "Readable error message", "error": "Bad Request" }
```

Common status codes: `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` not found, `500` server error.
