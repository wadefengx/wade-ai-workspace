---
status: draft
phase: Phase X
owner: PM
updated: YYYY-MM-DD
---

# SPEC-Phase X — <功能标题>

版本:0.1(YYYY-MM-DD)

## 1. 目标

1. 明确本期要解决的业务目标与用户价值。
2. 说明本期成功标准,避免实现偏航。
3. 标记与前序 phase 的衔接关系。

## 2. 范围与不做

### 范围

- 本期包含的功能点、页面、接口、权限边界。
- 需要联动的已有模块与数据。

### 不做

- 明确延后事项,避免 scope creep。
- 记录本期不处理但已知相关的问题或增强项。

## 3. 角色模型与权限

| 角色 | 说明 | 读权限 | 写权限 | 特殊限制 |
|------|------|--------|--------|----------|
| OWNER | 工作区创建者/最高角色 | 示例 | 示例 | 不可移除/不可降级 |
| ADMIN | 工作区管理员 | 示例 | 示例 | 不可操作 OWNER |
| MEMBER | 普通成员 | 示例 | 示例 | 仅限被授权能力 |

- 全局管理员与 workspace 角色的关系需写清楚。
- 最小权限原则:OWNER > ADMIN > MEMBER。
- 涉及守卫、成员校验、异常码时在此处写明。

## 4. API 契约

### 路由

```txt
GET    /api/...
POST   /api/...
PATCH  /api/...
DELETE /api/...
```

### 请求/响应约定

- 列表接口默认返回裸数组;分页消息返回 `{items, nextCursor}`。
- 错误统一 `{statusCode, message}`。
- 写清请求体、关键响应字段、权限要求、状态码与异常场景。

## 5. 实现要点

### 后端

- 模块/服务/控制器/Guard/Repository/Prisma 变更点。
- 复用现有能力与共享 helper,避免重复实现。
- 若涉及 AI/配置/权限联动,写明调用链与优先级。

### 前端

- 页面入口、路由、组件复用、状态管理、接口接入点。
- UI 行为、空态/错误态、权限态、成功反馈。
- 与现有布局、导航、主题、契约兼容要求。

## 6. 任务拆分

### PM

- 输出范围、边界、不做项。
- 维护 spec 与验收清单。

### 后端 lane

- 列出 API/数据模型/权限/测试任务。

### 前端 lane

- 列出页面、组件、交互、状态、测试任务。

### QA

- 列出接口验收、回归路径、e2e 场景、权限验证点。

## 7. 验收清单

1. `npm run lint --workspace=@wade/api`
2. `npm run typecheck --workspace=@wade/api`
3. `npm test --workspace=@wade/api`
4. `npm run lint --workspace=@wade/web`
5. `npm run typecheck --workspace=@wade/web`
6. `npm test --workspace=@wade/web`
7. 浏览器/e2e 按本期关键路径逐项验收并记录 PASS/FAIL。

## 8. 变更记录

| 日期 | 版本 | 变更 | 负责人 |
|------|------|------|--------|
| YYYY-MM-DD | 0.1 | 初版 spec | PM |
