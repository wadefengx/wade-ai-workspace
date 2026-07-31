---
status: done
phase: Phase 9
owner: PM
updated: 2026-08-01
---

# SPEC-Phase 9 — 会话体验 / JWT 续期 / AIOS 组织层

版本:1.0(2026-08-01)

## 1. 目标

1. 侧边栏可折叠/展开(折叠只显示 icon)。
2. Channels 更名 Chats:可搜索,按最后活跃时间倒序分组(今天 / 一周前 / 一月前 / 具体月份)。
3. Header 增加主题快捷切换按钮(light/dark)。
4. 登录态持久化:JWT access + refresh 双 token,前端无感刷新,可撤销(登出),过期重新登录——根治"整页刷新丢登录态"。
5. 仓库重构为 **AI Native Repository(AIOS)**:`.ai/` 组织层(Organization / Specification / Workflow / Knowledge / Runtime + Memory / Skill / Harness 贯穿),AGENTS.md 重写为 ≤200 行运行时入口。

## 2. 认证体系(第 4 条)

### 契约
```
POST /api/auth/login    {email, password} → {accessToken, refreshToken, user}
POST /api/auth/refresh  {refreshToken}    → {accessToken, refreshToken}(旋转;旧 refresh 作废)
POST /api/auth/logout   (Bearer access)   → {ok}(撤销当前 refresh token)
```
- access token:JWT,15 分钟过期,payload {sub, email, role}。
- refresh token:随机 32 字节,30 天过期,DB 存储哈希(`refreshTokens` 集合:{userId, tokenHash, expiresAt, createdAt});每次 refresh 旋转(旧 hash 删除,新 hash 写入)。
- 撤销:logout 删除该用户全部 refresh token;修改密码后删除全部 refresh token。
- JWT 校验失败(过期/无效)返回 401;refresh 无效/过期返回 401 → 前端强制重新登录。

### 前端
- `stores/auth.ts`:localStorage 存 {accessToken, refreshToken, user};`initialize()` 恢复顺序:有 access → /me;401 → 用 refresh 调 /auth/refresh → 新 token 落盘 → /me;refresh 失败 → 清空回 /login。
- `lib/api.ts` apiFetch:401 时尝试刷新(单例锁,并发请求排队等刷新完成后重放),重放仍 401 → 登出。所有请求带 `Authorization: Bearer <access>`。
- 退出登录:调 /auth/logout(撤销)+ 清 localStorage + 回 /login。
- 旧 token key `wade-ai-workspace-token` 兼容迁移:读到旧值则视为 refresh 缺失,直接走登录。

## 3. 侧边栏与 Chats(第 1/2 条)

### 折叠
- `workspace-navigation.tsx`:折叠状态持久化(zustand persist key `zone-ai-sidebar-collapsed`);折叠时宽度 64px,只显示 icon(workspace Select 简化、频道 icon、菜单 icon),展开恢复 280px;品牌区显示 logo 缩略。

### Chats
- API:`GET /api/workspaces/:workspaceId/channels` 返回结构增加 `lastMessageAt`(该频道最近一条消息时间,无消息为 null)+ `messageCount`(可选)。
- 前端:左侧列表重命名为 Chats;顶部搜索框(过滤频道名);分组按 lastMessageAt 相对当前时间:今天(同一天)、一周前(7 天内)、一月前(30 天内)、更早按 `YYYY年M月` 分组;组内倒序;组头显示分组名;无消息频道归入"暂无消息"组或不分组(置于最末)。

## 4. Header 主题按钮(第 3 条)

- `workspace-navigation.tsx` banner/顶部加主题切换 icon 按钮(Tooltip "切换主题"):点击在 light/dark 间切换(写 theme store);当前为 system 时按系统解析值显示。

## 5. AIOS 组织层(第 5 条)

### 目录布局(仓库根 `.ai/`)
```
.ai/
├── AGENTS.md(→ 仓库根 AGENTS.md 的替代入口,≤200 行)
├── organization/{constitution,team,routing,communication}.md + roles/{pm,architect,frontend,backend,qa,ux,devops}.md
├── runtime/{context-loading,model-routing,prompt-policy,tool-policy,coding-policy,context-priority}.md
├── workflows/{feature,bugfix,refactor,release,architecture,research}.md
├── specs/{TEMPLATE.md,active/,completed/,archived/}
├── skills/{common/,frontend/,backend/,architecture/,testing/,documentation/,ai/,devops/}
├── memory/{project,architecture,glossary,decisions,lessons,conventions,known-issues}.md
├── knowledge/{business/,product/,engineering/,framework/,references/}
├── architecture/{overview,tech-stack,modules,folder-structure,api-contract}.md + adr/{ADR-001..005}.md
├── harness/{evals/,fixtures/,benchmark/,regression/,prompts/,scorecards/}
├── templates/
└── changelog/
```
- 迁移:`specs/SPEC-*.md` → `.ai/specs/completed/`;`skills/{ponytail,sdd-workflow}.md` → `.ai/skills/common/`;docs service 读取路径同步改为 `.ai/specs/`、`.ai/skills/`(向后兼容旧路径)。
- AGENTS.md 重写:仅含 Mission / Context loading order / AI 生命周期 / 全局工程规则 / 目录索引 / 引用;正文内容下沉到 .ai/ 各文件。
- 五大对象模型(写进 .ai/organization/constitution.md):
  - Organization(AI 如何协作)→ Specification(做什么)→ Workflow(怎么做)→ Knowledge(知道什么)→ Runtime(如何执行);Memory / Skill / Harness 为贯穿生命周期系统。
- ADR-001~005:AI Native / Local First / MongoDB / Prisma / SDD。

## 6. 任务拆分(并行 lane)

- **Lane A(后端)**:refresh token 体系(schema/auth service/controller + 单测)+ channels lastMessageAt 聚合 + docs service 路径(.ai)+ Swagger 标注。
- **Lane B(前端)**:apiFetch 无感刷新 + auth store 恢复 + 侧边栏折叠 + Chats 搜索/分组 + header 主题按钮 + 退出登录撤销。
- **Lane C(AIOS)**:.ai/ 全量目录与文档(organization/runtime/workflows/memory/knowledge/architecture/ADR/harness)+ AGENTS.md 重写 + specs/skills 迁移。
- 契约:A 先行定义(auth 端点/B 按契约实现);C 的 docs 路径与 A 的 docs service 改动有交集——C 只迁移文件,A 只改 service 读取逻辑,spec 定死双路径兼容。

## 7. 验收

1. lint/typecheck/test(api、web)全过。
2. e2e:
   - 登录 → 刷新页面仍在登录态(不弹回登录);access 过期(测试改短)自动 refresh 无感;logout 后 refresh 失效(旧 refresh 调 /auth/refresh → 401)。
   - 侧边栏折叠/展开,刷新保持;Chats 搜索过滤;频道按时间分组显示(今天/一周前/月份)。
   - header 主题按钮 light↔dark 即时切换并持久化。
   - .ai/ 目录结构完整;AGENTS.md ≤200 行;docs 页能列出 .ai/specs 与 .ai/skills 文件。
3. AGENTS.md Change Log 追加。

## 8. 不做(后续)

- 多设备会话管理(设备列表/单设备踢出);refresh token 指纹(设备/IP);OAuth/SSO;聊天分组的手动置顶;消息内全文搜索。
