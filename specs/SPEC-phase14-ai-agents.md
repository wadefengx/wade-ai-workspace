---
name: SPEC-phase14-ai-agents
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 14:Agent 专家系统 + 默认 AI 对话 + 去 # 前缀

## Goal

用户三个诉求:
1. **默认 AI 对话**:chat 不再必须 @AI 才能触发 AI 回复——普通消息默认由 AI 回复;@具体专家则指定该专家回复。
2. **Agent 扮演人类专家**:Agent 可配置(CRUD 已有)、可扮演人类专家角色(如 PM/架构师/前端/后端/QA),每个专家有 **emoji 头像 + 名称**;输入框可 @各专家;点击专家浮出面板说明该专家能干什么。
3. **去 # 前缀**:侧边栏 channel 名前的 `#` 符号去掉(标题已由 AI 生成,不再需要频道语义的 #)。

非目标(本期):harness 底层接入(hermes/openclaw 运行时)只做**数据模型与配置 UI 预留**,真正调用留 Phase 15(需独立设计 ACP 桥接)。

## 现状(已勘察)

- 前端触发:`workspace-shell.tsx:527` `shouldTriggerAi = content.includes("@AI")`——唯一入口。
- Agent 模型(prisma):name/type(5 种)/engineType/providerConfigRef/capabilitiesJson/isDefault,缺 emoji、角色描述。
- Agent CRUD API 已有:GET/POST/PATCH/DELETE(`workspaces/:wid/agents` 等)。
- 侧边栏 `# {channel.name}` 硬编码 3 处:workspace-navigation.tsx:877/881/890。
- Agents 页(agents-page.tsx 548 行)已有 6 预设 + 表单,但无 emoji/角色/描述字段。
- 聊天输入框 Suggestion 已有成员 + @AI 候选(workspace-shell.tsx:741-742)。

## 任务

### Task 1:默认 AI 对话(无需 @AI)

1. `workspace-shell.tsx` 发送逻辑:去掉 `shouldTriggerAi = content.includes("@AI")` 的条件性——改为:
   - 消息含 `@专家名` → 发给该专家(AgentEngine 按 agent 执行)。
   - 消息含 `@AI` 或无 @ → 走默认 Agent(现有 ensureDefaultAgent)。
   - 纯 @成员(非 AI)消息 → 仅保存消息不触发 AI(保留多人协作语义)。
2. 触发判断后移到发送流程:发消息即 POST 到 channel;随后**总是**调用 AI stream(除非消息只是 @成员)。@AI 从 Suggestion 保留但不再是必要条件。
3. 输入框 placeholder 文案更新:"发送消息与 AI 对话,@专家指定专家"。

### Task 2:Agent 专家化(emoji + 角色 + 描述)

**Prisma schema**:
```prisma
model Agent {
  // 现有字段保留
  emoji        String?   // 专家 emoji 头像,如 🧠
  role         String?   // 角色名,如 "资深前端工程师"
  description  String?   // 面板展示:能干什么
  systemPrompt String?   // 专家 system prompt(可空,空则默认)
}
```

**后端**:
- AgentService CRUD DTO 增加 emoji/role/description/systemPrompt(可选字段,兼容旧数据)。
- streamAgentReply 时:若消息 @某 agent → systemPrompt 使用该 agent 的;否则默认。

**前端 agents-page.tsx**:
- 表单增加 emoji(输入或 emoji 选择)、role、description、systemPrompt 字段。
- 列表卡片显示 emoji + name + role。
- 6 预设补全专家化默认值(如 🤖 默认助手 / 🧠 架构师 / 🎨 设计师 / 🔧 前端 / ⚙️ 后端 / ✅ QA)。

**聊天输入框 @专家**:
- Suggestion 候选:成员 + **各 Agent(emoji + name)**。
- 消息渲染:@专家 高亮(同 @All 紫色高亮机制,颜色可按 agent 区分)。

**专家面板**:
- 点击消息中 @专家 或侧边栏/输入框候选 → Popover/Drawer 展示:emoji、name、role、description("我能做什么")。
- 复用 antd Popover,轻量实现。

### Task 3:去 # 前缀

- workspace-navigation.tsx:877/881/890 三处 `# {channel.name}` → `{channel.name}`;aria-label 同步去掉 #。

### Task 4:harness 预留(Phase 15 铺垫)

- Agent 模型增加 `harness String @default("OLLAMA")`(OLLAMA | HERMES | OPENCLAW),Agents 页 type 选择处显示 harness 标注。
- 仅数据层 + UI 展示,不实现调用(Phase 15 做 ACP 桥接)。

## Acceptance

- [ ] 发消息无 @AI 也能收到 AI 回复;@专家 名 → 专家回复(带其 systemPrompt)
- [ ] Agents 页可 CRUD emoji/role/description/systemPrompt;列表显示 emoji+name+role
- [ ] 输入框 @ 出现成员 + 专家候选;点击 @专家 浮出"我能做什么"面板
- [ ] 侧边栏 channel 无 # 前缀
- [ ] `npm run lint && npm run typecheck && npm run build` 全绿;API 单测通过
- [ ] 浏览器验收:建专家 → @专家 对话 → 面板展示,全链路无 console error

## Non-goals

- 不做 hermes/openclaw 真实调用(Phase 15)。
- 不改 workspace 权限模型。
- 不做多人 AI 并发回复。
