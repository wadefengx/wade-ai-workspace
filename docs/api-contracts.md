# API 契约（Phase 0）

基路径为 `/api/v1`。请求和响应均为 `application/json`，时间使用 ISO 8601 UTC，资源 ID 使用 UUID。

错误响应统一为：

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "可读错误信息" } }
```

常用状态码：`400` 参数错误、`401` 未认证、`403` 无权限、`404` 不存在、`409` 状态冲突、`500` 服务错误。

## 健康检查

### `GET /health`

无需认证。用于负载均衡和容器探针。

成功：`200`

```json
{ "status": "ok" }
```

依赖不可用时返回 `503`，并不得泄露连接串或内部拓扑。

## 认证（计划接口）

### `POST /auth/register`

请求：`{ "email": "user@example.com", "password": "..." }`  
成功：`201`，返回 `{ "user": { "id": "...", "email": "..." } }`。

### `POST /auth/login`

请求：`{ "email": "user@example.com", "password": "..." }`  
成功：`200`，返回用户信息和会话凭据。凭据采用安全的 HttpOnly Cookie 或 Bearer token；具体实现确定前不得同时启用两种机制。

### `POST /auth/logout`

需要认证。成功：`204`，使当前会话失效。

### `GET /auth/me`

需要认证。成功：`200`，返回当前用户 `{ "id": "...", "email": "..." }`。

## 工作区（计划接口）

以下接口均需要认证，且只允许资源所有者访问。

### `GET /workspaces`

成功：`200`

```json
{ "items": [{ "id": "...", "name": "demo", "status": "running", "updatedAt": "..." }] }
```

### `POST /workspaces`

请求：`{ "name": "demo" }`。成功：`201`，返回新工作区；初始状态为 `creating`。

### `GET /workspaces/{workspaceId}`

成功：`200`，返回工作区详情，包括 `id`、`name`、`status`、`createdAt`、`updatedAt` 和可选的连接信息。

### `POST /workspaces/{workspaceId}/start`

启动已停止工作区。成功：`202`，返回当前或过渡中的状态；运行中再次调用返回 `409` 或幂等的 `200`，实现需固定一种语义。

### `POST /workspaces/{workspaceId}/stop`

停止运行工作区。成功：`202`；非运行状态按与 start 相同的幂等规则处理。

### `DELETE /workspaces/{workspaceId}`

请求删除容器、卷及控制面记录。成功：`202`；删除处理中资源不可再启动。
