# SPEC-Phase 8 — 用户体系 / 资源 CRUD / Agent 生态 / 主题与品牌(Zone AI)

版本:1.0(2026-08-01)

## 1. 目标

1. 用户可新增/删除,角色 USER ↔ ADMIN 可变更,workspace OWNER 可转交。
2. 资源 CRUD 完备:workspace(改名/删除)、member(已有)、agents(创建/删除)、knowledge(改名)。
3. Agent 类型可选:ollama / openai-compatible / anthropic / openclaw / hermes;模型配置支持 API Key(参考 cc-switch 的预设 Provider 体验)。
4. Settings 模块启用:账户(改密码)/ 外观(主题)/ Workspace(改名、转交 OWNER、删除)/ 用户管理(全局 ADMIN)。
5. 深色/浅色主题切换(跟随系统可选)。
6. 头像下拉菜单:用户名/邮箱 + 个人详情 + 退出登录。
7. 输入框 `@All` 全员提及(插入文本 + 高亮展示,MVP 不做推送)。
8. 品牌更名为 **Zone AI**:左上角 logo、登录页、浏览器 tab(favicon + 动态标题随模块变化)。

## 2. 角色与权限

| 操作 | 全局 ADMIN | OWNER | ADMIN(工作区) | MEMBER |
|------|:--:|:--:|:--:|:--:|
| 用户列表/改角色/删除(全局) | ✅ | ❌ | ❌ | ❌ |
| Workspace 改名/删除/转交 OWNER | ✅ | ✅ | ❌ | ❌ |
| Agents 创建/删除 | ✅ | ✅ | ✅ | ❌ |
| Agents 配置修改 | ✅ | ✅ | ✅ | ✅ |
| Knowledge 文档改名 | ✅ | ✅ | ✅ | ✅ |
| 主题/账户(改密码)/个人详情 | ✅ | ✅ | ✅ | ✅ |

安全约束:
- 不能删除/降级自己;全局至少保留一个 ADMIN(降级/删除唯一 ADMIN → 400)。
- 转交 OWNER:目标必须是工作区成员;转交后原 OWNER 自动降为 ADMIN。
- 删除 Workspace 级联删除 channels/messages/members/knowledge/memories/agents。

## 3. API 契约(基路径 /api,全部需 JWT)

### 用户管理(全局 ADMIN)
```
GET    /api/users?q=xxx         → [{id,name,email,role,createdAt}](q 为空返回全部,limit 50)
PATCH  /api/users/:userId       {role: "USER"|"ADMIN"}   → 更新后用户
DELETE /api/users/:userId       → {id};级联删除其 workspaceMember 记录
```

### Workspace
```
PATCH  /api/workspaces/:workspaceId   {name}                       → 更新后 workspace(OWNER/ADMIN 全局)
POST   /api/workspaces/:workspaceId/transfer  {toUserId}           → {id}(仅 OWNER,目标须为成员)
DELETE /api/workspaces/:workspaceId                                → {id}(仅 OWNER,级联删除)
```

### Knowledge
```
PATCH  /api/knowledge/:documentId  {name}   → 更新后文档
```

### Agents(类型化 + 完整 CRUD)
```
GET    /api/workspaces/:workspaceId/agents   → [{id,name,type,engineType,isDefault,providerConfig:{baseUrl?,model?,hasApiKey}}]
POST   /api/workspaces/:workspaceId/agents   {name, type, providerConfig?}   → 新 agent(OWNER/ADMIN)
PATCH  /api/agents/:agentId                  {name?, providerConfig?}        → 同上结构
DELETE /api/agents/:agentId                                                  → {id}(OWNER/ADMIN,默认 agent 不可删 → 400)
```
`type` 枚举:`OLLAMA | OPENAI_COMPATIBLE | ANTHROPIC | OPENCLAW | HERMES`。
- OPENCLAW / HERMES 按 OPENAI_COMPATIBLE 处理(OpenAI 兼容端点),预设默认 baseUrl 提示。
- ANTHROPIC 走 `/v1/messages` 协议(新 AnthropicProvider)。
- apiKey 仅写入,读取返回 hasApiKey。

### 账户
```
PATCH  /api/auth/password  {currentPassword, newPassword}   → {ok}(校验旧密码,长度 ≥ 6)
```

### 文档浏览(specs / skills,成员登录即可)
```
GET /api/docs/specs               → [{name, title}](读取仓库根 specs/*.md,title 取首个 # 行或文件名)
GET /api/docs/specs/:name         → {name, content}(markdown 原文)
GET /api/docs/skills              → [{name, description}](skills/*.md frontmatter description)
GET /api/docs/skills/:name        → {name, content}
```
- 路径定位:`apps/api/src/docs` 用 `path.resolve(__dirname, "../../..")` 得到仓库根。
- 安全:`:name` 白名单校验(仅 `[A-Za-z0-9_-]`),防路径穿越;文件不存在 → 404。

## 4. 实现要点

### 后端(apps/api)
- `users` 模块扩展:list/patchRole/remove;`ensureGlobalAdmin(operatorId)`(role===ADMIN,否则 403);唯一 ADMIN 保护。
- `workspace.service`:updateWorkspace / transferOwnership / deleteWorkspace(事务级联删除;transfer 用事务:目标 member role=OWNER、原 OWNER → ADMIN)。
- `knowledge.service`:updateName。
- `agents`:schema 加 `type`(默认 OPENAI_COMPATIBLE 兼容存量);create/delete;删除默认 agent 拒绝。
- AI 运行时:
  - 新增 `AnthropicProvider`(实现 AIProvider,`/v1/messages`,system/user/assistant 转换,读 `content_block_delta` SSE)。
  - `default-chat.engine` 或 provider 工厂按 agent.type 选择 provider(ANTHROPIC → AnthropicProvider,其余 → OpenAICompatibleProvider);配置注入沿用 input.provider 覆盖机制。
- `auth.service`:changePassword。
- seed:保持 admin@wade.local/admin;存量 Agent 记录 type 默认值(prisma:push 后 updateMany 补 OLLAMA/OPENAI_COMPATIBLE)。
- 单测:users(admin 校验/唯一 admin 保护)、workspace(转交/级联删)、agents(create/delete/默认保护)、anthropic provider(消息转换)。

### 前端(apps/web)
- **主题**:`theme/store.ts`(zustand persist:`light|dark|system`);`providers.tsx` ConfigProvider 按主题注入 antd `theme.darkAlgorithm/lightAlgorithm`;`globals.css` 增加 `:root[data-theme="dark"]` 变量覆盖(背景 #0f1420 系、surface #161c2b、text #e8ecf4、line #232b3d,主色保持 #024AD8);layout 根节点同步 `document.documentElement.dataset.theme`;system 模式监听 matchMedia。
- **Settings 页** `app/(workspace)/settings/page.tsx` + `components/settings-page.tsx`:
  - 账户:改密码表单(当前密码/新密码)。
  - 外观:主题 Radio(浅色/深色/跟随系统)。
  - Workspace(OWNER/ADMIN 全局可见):改名、转交 OWNER(Select 选成员 + Popconfirm)、删除(Popconfirm,级联提示)。
  - 用户管理(仅全局 ADMIN 可见):用户表格(姓名/邮箱/角色 Tag/注册时间)+ 角色切换(USER↔ADMIN,自己行禁用)+ 删除(自己行禁用)+ 顶部搜索。
  - 导航 `workspace-navigation.tsx` 的 Settings 启用,label 改 "Settings"。
- **头像下拉菜单**(`workspace-navigation.tsx` banner 用户按钮):Dropdown,header 显示头像+用户名+邮箱,菜单两项:个人详情(Modal:头像/邮箱/角色/注册时间)、退出登录(清 token 回 /login)。
- **Agents 页**:配置表单增加 `type` 选择(5 种,每类显示对应字段:ANTHROPIC/OPENAI_COMPATIBLE 显示 apiKey;预设 provider 快捷选择:OpenAI/DeepSeek/Ollama/Claude/OpenClaw/Hermes,选中自动填 baseUrl+model 建议值);新增/删除 agent 按钮(默认 agent 删除禁用);apiKey 占位 "已保存,留空保持不变"。
- **@All**:workspace-shell Suggestion mentionItems 顶部加 `{label:"All members", value:"@All", icon:<TeamOutlined/>}`;消息渲染中 `@All` 高亮(紫色 Tag 风格)。
- **Specs / Skills 页** `app/(workspace)/specs/page.tsx` + `components/specs-page.tsx`、`app/(workspace)/skills/page.tsx` + `components/skills-page.tsx`:左侧文件列表(标题/描述)+ 右侧 markdown 内容(react-markdown 已有);导航菜单由 Lane B 在 `workspace-navigation.tsx` 添加 Specs(icon FileTextOutlined)/ Skills(icon BulbOutlined)入口。
- **品牌 Zone AI**:
  - `app/layout.tsx` title "Zone AI" + `app/icon.svg`(渐变蓝底圆角方块 + 白色 Z 形,主色 #024AD8→#6a8dff 渐变)。
  - `auth-page.tsx`、`workspace-navigation.tsx` 的 "Wade AI" → "Zone AI",左上角放 icon。
  - 动态 tab 标题:`workspace-navigation`/layout 内 `useEffect(() => { document.title = \`Zone AI · ${moduleLabel}\` }, [pathname])`(聊天=Workspace、Knowledge、Memory、Members、Agents、Settings)。
- 登录/注册页:顶部展示 icon + "Zone AI"。

## 5. 任务拆分(并行 lane)

- **Lane A(后端)** 全量 API(用户/workspace/knowledge/agents/账户/docs 浏览)+ AnthropicProvider + 单测。文件:`apps/api/src/{users,workspace,knowledge,agents,auth,ai,docs}`。
- **Lane B(前端-基础)** 主题系统 + 品牌(favicon/logo/改名/tab 标题)+ 头像下拉菜单 + 导航菜单项(启用 Settings、新增 Specs/Skills 入口)。文件:`apps/web/src/{styles/globals.css,app/{layout.tsx,icon.svg,providers.tsx},components/{auth-page,workspace-navigation}.tsx,theme/store.ts}`。
- **Lane C(前端-页面)** Settings 页 + Agents 预设/CRUD UI + @All + Specs/Skills 页面。文件:`apps/web/src/{app/(workspace)/{settings,specs,skills},components/{settings-page,agents-page,specs-page,skills-page}.tsx,components/workspace-shell.tsx}`。
- 依赖:Lane A 契约先定(本 spec);B/C 按契约实现,联调在 QA 阶段。

## 6. 验收

1. lint/typecheck/test(api、web)全过。
2. e2e:
   - admin 登录 → Settings > 用户管理:把 bob 提升 ADMIN、再降回 USER、删除新注册用户;删除自己/唯一 ADMIN → 400 提示。
   - alice(OWNER)→ Settings > Workspace:改名 → 转交 OWNER 给 bob → 确认 bob 变 OWNER、alice 变 ADMIN;删除一个临时 workspace 验证级联。
   - Agents:创建 openclaw 类型 agent → 删除;默认 agent 删除被拒;ANTHROPIC 类型配置 apiKey 后 hasApiKey=true。
   - 主题:切换深色,全站(聊天/各页/登录页)变暗,刷新保持;跟随系统生效。
   - 头像菜单:显示用户名/邮箱;个人详情 Modal;退出登录回 /login。
   - 输入框 `@` → All members 选项,插入 @All 并发送,消息中高亮。
   - 品牌:tab 标题随模块变化;favicon 显示;登录页与左上角为 Zone AI 图标。
3. AGENTS.md Change Log 追加。

## 7. 不做(后续)

- @All 真实推送/通知中心;多 Agent 并行路由与 Agent 编排;用户软删除与数据保留策略;i18n(中英切换);头像上传。
