# SPEC-Phase 11 — 聊天体验重构 + AI Organization Dashboard + Feedback Dashboard

版本:1.0(2026-08-01 深夜冲刺)

## 1. 目标

1. **滚动隔离 + 自动到底**:chat/memory 页内容区独立滚动(侧边栏/header 固定不滚);打开 chat 自动滚到底部;新消息到达自动跟随。
2. **移除右侧 AI Context / Workspace Members 面板**(workspace-shell 右侧 complementary)。
3. **ChatGPT 式新建对话**:点击"新建 Chat"直接创建新 channel 并进入(不弹选择);对话即 channel,零摩擦。
4. **AI 回答增强**:thinking progress 展示(流式时显示思考动画/过程);回答 hover 右下角操作按钮:like / dislike / regenerate / copy。
5. **输入框状态**:等待 AI 回应时输入框 loading + 状态跑马灯;使用 @ant-design/x 现成组件(Bubble / Thinking / Sender loading)重构。
6. **AI Organization Dashboard**:Agents 状态、Running Lanes 进度、Pipeline 阶段、知识资产计数(Skills/Specs/Memory/ADR/Harness)、Today's Improvements;反馈统计(Feedback Dashboard)。
7. 全部完成后 lint/typecheck/test/build + 浏览器全量验收。

## 2. 滚动隔离(第 1 条,根因修复)

- 根因:内容区无独立滚动容器,页面整体滚动。
- 方案:`(workspace)/layout.tsx` 的 shell 改 `height: 100vh; overflow: hidden`,侧边栏/header/内容区各自 `overflow-y: auto`(内容区 `flex:1; min-height:0`)。
- chat 消息区:新建 `ChatMessageList` 用 ref + `scrollTo({top: scrollHeight})`;打开/新消息自动到底;用户上滚查看历史时不强制跟随(距离底部 <100px 才自动跟)。
- memory 页:复用同一滚动容器模式(内容区 overflow auto)。
- 验证:滚动内容区时侧边栏/header 纹丝不动(浏览器实测 getBoundingClientRect 前后一致)。

## 3. 移除右面板(第 2 条)

- workspace-shell.tsx:删除右侧 complementary(AI Context / Workspace Members),内容区占满剩余宽度。

## 4. ChatGPT 式新建对话(第 3 条)

- workspace-navigation:CHATS 区"新建 Chat"按钮改为直接 `createChannel(workspaceId, {name: auto 生成})` → 进入新对话;不弹 Modal。
- 新对话命名:`对话 <N>`(取当前最大序号);空对话的 channel 展示"开始新的对话"占位。
- 现有频道列表保留(历史对话),分组逻辑不变。

## 5. AI 回答增强(第 4 条)

- **thinking 展示**:流式接口若返回 reasoning 内容则展示为可折叠"思考过程"(气泡内上方,淡色块);否则显示 Thinking 动画(antdx `<Thinking />` 或 Bubble loading 状态:三点脉冲)。
- **操作按钮**:AI 消息 hover 时右下角浮出操作条(like / dislike / regenerate / copy):
  - like/dislike:`PATCH /api/messages/:messageId/feedback {type: "like"|"dislike"}`(幂等,再点取消);按钮态高亮。
  - regenerate:前端重发同 user prompt(找到该 AI 消息对应的用户消息),流式追加新 AI 回复(不删除旧的,新回复作为后续消息)。
  - copy:复制 AI 文本到剪贴板 + Tooltip "已复制"。
- 用户消息 hover 只显示 copy。

## 6. 输入框状态与 antdx 组件(第 5 条)

- 用 antdx `<Sender>` 的 `loading` prop(发送后 loading=true,流式结束 false,期间 Sender 禁用发送 + 动画点)。
- 状态跑马灯:流式开始时输入框上方出现状态条(`<Bubble loading>` 或自定义跑马灯:"正在思考…"(Thinking 动画));显示 agent 名 + 模型。
- 保留现有 @ 提及 / emoji / 快捷发送逻辑。

## 7. AI Organization Dashboard(第 6 条)

### 数据 API(后端)
```
GET /api/stats/organization → {
  assets: { specs, skills, memory, adr, harness, knowledge },   // 读 .ai/ 目录递归计数
  lanes: [{id, title, status, confidence}],                      // 读 .ai/registry/lanes.yaml(不存在→从 git log 最近 commits 推断最近 lanes)
  pipeline: [{stage, status}],                                   // 从 lanes 状态推导
  improvements: { skills: +n, adr: +n, memory: +n, harness: +n, specs: +n } // 最近 24h git log --stat 计数(近似)
}
GET /api/stats/feedback → {
  total, like, dislike, ratio,
  byChannel: [{channelId, channelName, total, like}],
  byDay: [{date, total, like}]                                  // 近 7 天
}
```
- `GET /api/stats/feedback` 聚合 Message.feedback 字段;无反馈数据时返回零值(页面显示空状态)。
- 单测:stats service 计数逻辑(注入 mock fs/目录结构)+ feedback 聚合。

### 页面(Dashboard)
- 路由:`app/(workspace)/dashboard/page.tsx` + `components/dashboard-page.tsx`;导航菜单加"Dashboard"(icon: DashboardOutlined,Knowledge 上方)。
- 布局(参考 GPT 蓝图 + 现代 SaaS dashboard):
  - 顶部:标题 + 更新时间 + 刷新按钮。
  - Agents 状态卡:PM/FE/BE/QA/UX/Architect 六角色,圆点在线态(🟢/🟡/🔵)+ 当前 lane。
  - Running Lanes 卡:每个 lane 名称 + 进度条(状态→百分比:Ready 10 / Running 60 / Review 80 / QA 90 / Done 100)+ confidence 标签。
  - Pipeline 卡:Planner → Spec → Implement → Review → Harness → Memory 阶段列表,✔/⏳/○ 状态灯。
  - 资产统计卡:Skills/Specs/Memory/ADR/Harness/Knowledge 大数字 + icon(计数动画 framer-motion 数字滚动)。
  - Today's Improvements 卡:+n 列表(带 icon)。
  - Feedback Dashboard 卡:like/dislike 比率环形图(antd Progress type=circle)+ 近 7 天柱状(纯 CSS/div 柱形,不引图表库)+ 按频道 Top 列表。
- 动效:framer-motion 卡片入场 stagger、数字滚动、进度条动画;Apple 风格(毛玻璃卡/圆角/渐变)。

## 8. 任务拆分(并行 lane)

- **Lane A(后端)**:Message.feedback schema + PATCH feedback API(幂等切换)+ stats API(organization/feedback)+ 单测。文件:`apps/api/src/{chat,stats(新),prisma}`。
- **Lane B(前端-聊天)**:滚动隔离(共享滚动容器 CSS)+ 移除右面板 + 自动到底 + ChatGPT 式新建 + Bubble/Thinking/Sender loading + 消息操作按钮(like/dislike/regenerate/copy)+ 导航加 Dashboard 菜单项。文件:`(workspace)/layout.tsx`、`workspace-shell.tsx`、`workspace-shell.module.css`、`workspace-navigation.tsx`、`workspace-context.tsx`(createChannel 已有,可能需要直接进入逻辑)、`memory-page.tsx`。
- **Lane C(前端-Dashboard)**:dashboard 路由 + 页面组件(全部新文件)+ framer-motion 动效 + 与 stats API 对接。文件:`app/(workspace)/dashboard/page.tsx`、`components/dashboard-page.tsx`(新)、`components/dashboard-page.module.css`(新)。
- 依赖:B 先加菜单项(路由字符串,不 import C);C 按 spec 契约调 stats API;A 的 stats API 契约以本 spec 为准。

## 9. 验收

1. lint/typecheck/test/build(api、web)全过。
2. 浏览器:
   - chat 打开自动到底;滚动内容区,侧边栏/header 固定(坐标实测);memory 页同。
   - 右侧面板消失,内容区加宽。
   - 新建 Chat 一键创建进入,无弹窗。
   - @AI 提问:输入框 loading + 状态跑马灯;回复出现 thinking 展示;hover 回复右下角 like/dislike/regenerate/copy 可用(regenerate 产生新回复;copy 剪贴板)。
   - Dashboard:资产计数非零、lane 进度条、pipeline 状态灯、feedback 比率图(即使零数据也有空态)。
   - 深色模式全兼容。
3. AGENTS.md Change Log + 记忆更新。

## 10. 不做(后续)

- 消息编辑/删除;多模型对比;流式 reasoning 持久化展示(本次仅动画+文本兜底);Dashboard 实时 WebSocket(手动刷新即可);图表库引入(纯 CSS 实现)。
