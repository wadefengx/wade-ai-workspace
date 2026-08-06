# API 契约(当前)

基路径 `/api`(NestJS 全局前缀)。JSON,时间 ISO 8601 UTC,ID 为 MongoDB ObjectId。完整 OpenAPI 见 Swagger:http://localhost:3001/api/swagger

认证:注册/登录后返回 `accessToken`(Bearer);`/auth/refresh` 轮换。除健康检查与注册/登录外均需 `Authorization: Bearer <token>`。

## 认证 `/api/auth`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/register | `{email, password, name?}` → 201 |
| POST | /auth/login | `{email, password}` → `{accessToken, user}` |
| POST | /auth/refresh | `{refreshToken}` → 新 token 对 |
| POST | /auth/logout | 使当前 refresh token 失效 |
| GET | /auth/me | 当前用户信息 |
| PATCH | /auth/password | `{oldPassword, newPassword}` |

## Workspace `/api/workspaces`(需 WorkspaceMember 权限)

- `GET /`、`POST /`(建 workspace)、`GET /:id`、`PATCH /:id`、`DELETE /:id`
- `GET /:id/channels`、`POST /:id/channels`(建频道)
- `GET /:id/members`、`POST /:id/members`、`PATCH /members/:memberId`、`DELETE /members/:memberId`
- Workspace 响应含 **defaultAgentId**(Phase 16:对话默认 Agent)

## 聊天 `/api/channels`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /channels/:id/messages | 消息历史(游标分页) |
| POST | /channels/:id/messages | `{content, mentionIds?}` → 201 消息 |
| PATCH | /channels/:id/messages/:msgId/feedback | `{feedback: like\|dislike\|null}` |
| POST | /channels/:id/generate-title | AI 生成对话标题 |
| POST | /channels/:id/ai/stream | **SSE 流式 AI 回复** |

**SSE 事件**(stream):`token {content}` / `citations {citations: [{index, filename, chunkIndex, content}]}` / `reasoning` / `done` / `error {message}`。

## Agents `/api`(Phase 14/15/16)

- `GET /workspaces/:id/agents`、`POST /workspaces/:id/agents`、`PATCH /agents/:id`、`DELETE /agents/:id`
- `POST /agents/:id/test` — **测试连接**(调 provider 验证 baseUrl/key/model)
- Agent 字段:name、type(OLLAMA/OPENAI_COMPATIBLE/ANTHROPIC/OPENCLAW/HERMES)、engineType、emoji、role、description、systemPrompt、harness、providerConfigRef(只写不回,响应为 `hasApiKey`)、embeddingModel/embeddingBaseUrl

## Knowledge(RAG)`/api`

- `POST /workspaces/:id/knowledge`(上传文档,multipart)
- `GET /workspaces/:id/knowledge`、`PATCH /knowledge/:docId`、`DELETE /knowledge/:docId`
- `POST /knowledge/:docId/reindex`(重新切片;contentHash 相同跳过)

## Memory(Phase 16 分层)`/api`

- `GET /workspaces/:id/memories`、`POST /workspaces/:id/memories`(手建)
- `PATCH /memories/:id`、`DELETE /memories/:id`
- **`POST /channels/:id/memories/extract`** — 从频道对话抽取 L1 原子 → L2 场景(LLM JSON,失败降级返回 `{success:false}`)

## Docs / Stats / Users

- `GET /docs/specs`、`GET /docs/specs/:name`、`GET /docs/skills`、`GET /docs/skills/:name`(浏览 SDD 规格与技能)
- `GET /stats/organization`(AI 组织仪表盘)、`GET /stats/feedback`
- `GET /users`(用户管理,全局管理员)

## 健康检查

- `GET /api/health` → `{status: "ok"}`(仅 DB ping;ollama 为可选,不影响健康)

## 错误格式

```json
{ "statusCode": 400, "message": "可读错误信息", "error": "Bad Request" }
```

常用状态码:`400` 参数、`401` 未认证、`403` 无权限、`404` 不存在、`500` 服务错误。
