# AGENTS.md — Wade AI Workspace (Master Context)

## 项目意图

面向团队的本地 AI Native Workspace:人类讨论 → AI 协作 → 知识/记忆沉淀 → 后续会话自动获得上下文。
MVP 只做本地闭环,`docker compose up --build` 一键启动(web + api + mongodb + ollama)。

详细产品计划见 `ZoneAIWorkSpace.md`,实施规格见 `docs/SPEC-*.md`。

## 技术栈与目录

- `apps/web`:Next.js 16 (App Router) + React 19 + Ant Design 6 + @ant-design/x(Sender/Suggestion/Bubble)+ Zustand + TanStack Query,样式 CSS Modules + CSS Variables,主色 `#024AD8`。
- `apps/api`:NestJS 11 + Prisma 6(MongoDB replica set)+ JWT(自写 Guard,无 passport)。API 全局前缀 `api`。
- 目录约定:`apps/api/src/{auth,workspace,chat,ai,knowledge,memory,prisma,repositories,common}`,`apps/web/src/{app,components,features,lib,stores,theme,styles}`。

## 关键约定

- **契约**:列表接口返回裸数组(workspaces/channels/members/knowledge/memories),分页消息返回 `{items, nextCursor}`;web 端用 `lib/api.ts` 的 `unwrapItems` 兼容两者。错误统一 `{statusCode, message}`。
- **权限**:所有 workspace 路由 = JwtAuthGuard + 成员校验;写操作按角色最小权限(OWNER > ADMIN > MEMBER)。
- **角色**:OWNER(创建者,不可改/删)> ADMIN(可管理成员)> MEMBER。创建 workspace 自动成为 OWNER 并生成 `#general`。
- **AI**:`AIProvider`(OpenAI-compatible,env 或 DB 配置)→ `DefaultChatEngine`(频道上下文 + Memory 注入 + Knowledge RAG)。`@AI` 触发流式。Provider 密钥只存服务端。
- **本地验证栈**(非 Docker):mongod 8.2.7 在 `~/mongodb-local`(replSet rs0,127.0.0.1:27017),mongosh/ollama 走 Homebrew。
- 镜像源:npmmirror(npm)/gitclone(github tap);Docker Hub 不可达时 quay.io 替代。

## SDD 工作流(specs 驱动)

每期需求按以下流程推进,产出物进 `specs/` 文件夹,由 Hermes 编排:

1. **需求提出**(用户)→ PM 功能系分:范围、边界、不做项。
2. **架构设计**:PM + 前端开发 + 后端开发协同(路由/契约/数据模型/权限)。
3. **任务拆分**:PM 拆分为后端 lane / 前端 lane / QA 任务,写入 spec。
4. **产出 spec**:`specs/SPEC-<phase>.md`(模板见 `specs/TEMPLATE.md`),评审通过才开发。
5. **开发**:各角色按 spec 实施(可用多 Copilot Agent 并行),lint/typecheck/test 门禁。
6. **QA 验收**:对照 spec 验收清单跑 e2e,报告 PASS/FAIL。
7. **沉淀**:经验写回 `skills/`(通用 skill);关键结论写入 Hermes memory;AGENTS.md Change Log 追加。

## 团队通用 Skill(skills/)

- `skills/ponytail.md` — 全团队 common skill:懒惰工程哲学(最短可行实现、YAGNI、根因修复),所有角色开发时必须遵守。
- `skills/sdd-workflow.md` — 上述 SDD 工作流的操作化版本。
- 新沉淀的通用 skill 一律放 `skills/`,并在 AGENTS.md 登记一行。

## AI 开发团队规章

本仓库默认以「模拟人类开发团队」方式推进:多 Copilot Agent 并行(PM/UX/UI/前端/后端/QA),由 Hermes 编排派活与验收。

| 角色 | 职责 | 产出 |
|------|------|------|
| PM | 定义范围、拆分阶段、维护 SPEC | `docs/SPEC-*.md`、任务简报 |
| UX/UI | 交互与视觉设计约束 | 页面规格、组件与样式约定(并入任务简报) |
| 前端开发 | `apps/web` 实现 | 页面/组件/状态/样式 |
| 后端开发 | `apps/api` 实现 | 模块/服务/控制器/单测 |
| QA | 验收与回归 | 单测补全、e2e 脚本、验收报告 |

协作规则:
- API 与 Web 两个 lane 并行;同一 lane 内串行(避免 app.module.ts / workspace-shell.tsx 冲突)。
- 每个 agent 用 `copilot --yolo --model gpt-5.4 -p "<简报>"`,简报必须自包含(路径、契约、禁止项、验收命令)。
- 依赖预装:新依赖由编排者先 `npm install`(npmmirror),agent 不再装包。
- QA 在实现 lane 完成后执行:跑通 lint/typecheck/test + 浏览器 e2e,报告 PASS/FAIL。

## AI 维护契约

- 每次变更在本文档末尾 Change Log 追加一行(日期 + 摘要 + 涉及文件)。
- 实施前先读对应 `specs/SPEC-*.md`,spec 与实现冲突时以 spec 为准并更新 spec。
- 验收门禁:`npm run lint / typecheck / test`(api、web 各自),关键路径跑通后更新 Change Log。

## Change Log

- 2026-07-31 Phase 0-5 MVP 完成(6 Copilot Agent 并行):认证/工作区/频道/消息/@AI 流式/知识库 RAG/Memory CRUD。修复:unwrapItems 契约兼容、members 扁平化、AiModule 导出 OllamaService、antd Layout flex-direction。
- 2026-08-01 输入框升级为 @ant-design/x Sender + Suggestion:输入 `@` 弹出 AI/成员选择、实时筛选、emoji 面板(光标插入)。
- 2026-08-01 Phase 6 后端完成:新增 members/users/agents API 与单测,默认 Agent Provider 配置注入 AI 流式链路,注册 `UsersModule`/`AgentsModule` 并扩展 `WorkspaceModule`。涉及 `apps/api/src/{workspace,users,agents,ai,app.module.ts}`。
- 2026-08-01 Phase 6 Web 完成:启用 Agents 导航、新增 Members 成员管理页与 Agents 模型配置页,复用 WorkspacePageFrame 与页面卡片骨架(涉及 `apps/web/src/app/{members,agents}/page.tsx`,`apps/web/src/components/{workspace-page-frame,members-page,agents-page,workspace-pages.module.css}`)。
- 2026-08-01 Phase 6 QA 验收:verify-phase6.sh 30/30 通过(成员增删改角色/权限隔离/Agent 配置注入 AI 流式/用户搜索);补充 workspace-shell 聊天页菜单启用 Agents 并新增 Members 入口。
- 2026-08-01 Workspace SPA Tab Layout:新增 `app/(workspace)/layout.tsx` 统一 workspace 内布局并提取 `workspace-navigation.tsx`,聊天/Knowledge/Memory/Members/Agents 改为共享 sidebar + context 的同一 layout,`workspace-page-frame.tsx`/`workspace-shell.tsx` 改为仅渲染内容区(涉及 `apps/web/src/app/(workspace)/**`,`apps/web/src/components/{workspace-context,workspace-navigation,workspace-page-frame,workspace-shell}.tsx`,`apps/web/src/lib/workspace-navigation.ts`)。
- 2026-08-01 后端补充 Swagger 与全局管理员 RBAC:启用 `/api/docs`,为 DTO/控制器添加 Swagger 注解,新增 `UserRole.ADMIN` + admin seed/JWT/Guard/Service 放行与相关单测(涉及 `apps/api/src/{main,auth,common,workspace,agents,knowledge,memory,chat,users,health}` 与 `apps/api/prisma/{schema,seed}.ts`)。
- 2026-08-01 工程化:specs 流程化(`specs/` 目录 + TEMPLATE.md,SPEC-phase6 迁移)、团队 skills(`skills/ponytail.md` common skill + `skills/sdd-workflow.md`)、README 测试账号表(admin/admin 全局管理员、alice/bob)、git 初始化(首次 commit)。
- 2026-08-01 Phase 8 Lane A 后端完成:扩展 users/workspace/knowledge/agents/auth APIs,新增 docs 浏览模块与 AnthropicProvider,默认 Agent 类型化/回填,Swagger 入口调整为 `/api/swagger` 以避让 `/api/docs/*` 文档浏览路由(涉及 `apps/api/src/{auth,users,workspace,knowledge,agents,ai,docs,prisma,chat,app.module.ts,main.ts}` 与 `apps/api/prisma/{schema,seed}.ts`)。
- 2026-08-01 Phase 8 Lane B 前端基础完成:新增持久化主题模式(light/dark/system)、Zone AI 品牌与 favicon、workspace 动态标题、头像菜单桥接与 Settings/Specs/Skills 导航入口(涉及 `apps/web/src/{app/{layout.tsx,providers.tsx,icon.svg},components/{auth-page.tsx,workspace-navigation.tsx,auth-page.module.css,workspace-shell.module.css,workspace-pages.module.css},styles/globals.css,theme/store.ts}`)。
- 2026-08-01 Phase 8 Lane C 前端页面完成:新增 Settings / Specs / Skills 页面,扩展 Agents 预设与创建删除 UI,聊天输入支持 `@All` 提及与高亮(涉及 `apps/web/src/app/(workspace)/{settings,specs,skills}/page.tsx`,`apps/web/src/components/{settings-page,agents-page,specs-page,skills-page,workspace-shell}.tsx`)。
