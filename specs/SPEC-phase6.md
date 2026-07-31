# SPEC-Phase 6 — 成员与权限管理 + Agent 模型配置

版本:1.0(2026-08-01)

## 1. 目标

1. 团队成员管理:添加/移除成员、角色管理(OWNER > ADMIN > MEMBER),左侧菜单新增 Members 入口。
2. Agent 模型配置:启用左侧 Agents 入口,支持配置默认 Chat Agent 的 Provider(本地 Ollama / OpenAI 兼容远程),配置即时生效。
3. Memory/Knowledge 已有 CRUD,本阶段仅补足联动(成员变化影响记忆可见性检查),不做新功能。

## 2. 角色模型

| 角色 | 说明 | 成员管理 | 模型配置 |
|------|------|----------|----------|
| OWNER | 工作区创建者,唯一不可被移除/降级 | ✅(含改 ADMIN 角色) | ✅ |
| ADMIN | 管理员 | ✅(不可操作 OWNER) | ✅ |
| MEMBER | 普通成员 | ❌ | ✅ |

- 每个 workspace 至少保留一个 OWNER(移除/降级最后一个 OWNER 返回 400)。
- 添加成员时不能直接授予 OWNER。
- schema:`WorkspaceRole` 枚举增加 `ADMIN`(`apps/api/prisma/schema.prisma`,db push 生效)。

## 3. API 契约(基路径 `/api`)

### 成员管理

```
GET    /api/users/search?q=xxx            # 按邮箱/名称前缀搜用户(登录即可),limit 10,返回 [{id,name,email}]
POST   /api/workspaces/:workspaceId/members   # {email, role?: MEMBER|ADMIN} 仅 OWNER/ADMIN
PATCH  /api/members/:memberId             # {role: MEMBER|ADMIN} 仅 OWNER/ADMIN,目标为 OWNER→403,最后一个 OWNER→400
DELETE /api/members/:memberId             # 仅 OWNER/ADMIN,OWNER→403,最后一个 OWNER→400
```

- 添加已存在成员 → 409;邮箱未注册 → 404。
- 错误:`{statusCode, message}`(中文)。

### Agent 配置

```
GET   /api/workspaces/:workspaceId/agents   # [{id,name,engineType,providerConfig:{baseUrl,model,hasApiKey}}]
PATCH /api/agents/:agentId                  # {name?, providerConfig?: {baseUrl?, apiKey?, model?}}
```

- `apiKey` 仅写入,读取时只返回 `hasApiKey`。
- 运行时优先级:DB providerConfig > 环境变量(`AI_PROVIDER_*` / `OLLAMA_*`)。

## 4. 实现要点

### API

- `workspace.service.ts` 增加 `addMember / updateMemberRole / removeMember`,共用 `ensureManager(workspaceId, userId)`(OWNER/ADMIN 校验)与 `ensureOwnerExists`(最后一个 OWNER 保护);`WorkspaceMemberGuard` 不变。
- 新增 `users` 模块(search 端点,`prisma.user.findMany({where: {OR: [{email contains q}, {name contains q}]}})` 大小写不敏感)。
- 新增 `agents` 模块:CRUD 于 `Agent` 表(已有模型,`providerConfigRef` JSON)。
- AI 配置注入(最小侵入):`AIProviderStreamInput` 增加可选 `provider?: {baseUrl?, apiKey?, model?}`;`OpenAICompatibleProvider` 将 4 处 env 读取收敛为 `resolveConfig(input)`(input 优先);`DefaultChatEngine.stream` 先查当前 workspace 默认 agent 的 `providerConfigRef` 传入。

### Web

- `workspace-page-frame.tsx` navItems:启用 `agents`,新增 `members`(icon TeamOutlined),`settings` 保持禁用。
- 新增 `app/members/page.tsx` + `components/members-page.tsx`:
  - 成员表格:头像(首字母)/姓名/邮箱/角色 Tag(OWNER 金色/ADMIN 蓝/MEMBER 灰)/加入时间/操作。
  - 添加成员弹窗:邮箱搜索(Select showSearch + remote search `/users/search`)+ 角色选择(MEMBER/ADMIN)。
  - 角色切换 Select(OWNER 行禁用)、移除 Popconfirm(OWNER 行禁用)。
  - 本人 OWNER/ADMIN 才显示管理操作;非管理角色只读。
- 新增 `app/agents/page.tsx` + `components/agents-page.tsx`:
  - 默认 Agent 卡片:名称/engineType/能力描述。
  - 配置表单:Provider 类型(ollama | openai-compatible)→ baseUrl、model、apiKey(占位"已保存,留空保持不变")、保存。
  - 保存成功 message + invalidate 查询。
- 新页面复用 `workspace-page-frame.tsx` + `unwrapItems`。

## 5. 验收

1. `npm run lint/typecheck/test --workspace=@wade/api` 与 web 全过。
2. 浏览器 e2e:
   - alice(OWNER)进入 Members → 搜索并添加 bob 为 MEMBER → bob 登录可见该 workspace(可聊天、不可管理成员)→ alice 将 bob 提升 ADMIN → bob 可管理成员(添加 carol)→ alice 移除 carol。
   - OWNER 行角色切换与移除按钮禁用;尝试移除 OWNER 得到 403 提示。
   - Agents 页:把默认 Agent 的 model 改为 `qwen3:8b`(Ollama)保存 → @AI 流式仍正常;保存远程 provider(baseUrl/model/apiKey)后列表显示 hasApiKey。
3. 更新 AGENTS.md Change Log。

## 6. 不做(后续)

- 成员邀请链接、注册即加入;多 Agent 引擎(Planner/Tool);Agent Marketplace;设置页(企业配置)。
