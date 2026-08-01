---
status: done
phase: Phase 10
owner: PM
updated: 2026-08-01
---
# SPEC-Phase 10 — UX/UI 重构:侧边栏 / 动画 / 状态管理 / 文档图表 / 视觉 Apple 化

版本:1.0(2026-08-01)

## 1. 目标

1. 侧边栏折叠后必须有清晰的展开按钮;折叠态 icon 布局/尺寸/交互重新设计。
2. 引入成熟动画库(framer-motion),页面切换/列表/弹层基础动效。
3. 前端数据状态统一 zustand 管理(workspace context 迁移,导出 API 兼容)。
4. 界面整体视觉(布局不动):字号/图标放大、间距层次 Apple 化。
5. 文档渲染支持 mermaid / plantuml / c4 图。
6. 时间处理统一 dayjs。
7. Workspace 支持预设 icon(antd icon 库),创建时可选,侧边栏展示。
8. 登录/注册页 UX 重构。

## 2. 技术决策

- **动画**:`framer-motion`(已装依赖由编排者预装)。用途:workspace 内容区切换 fade/slide、侧边栏折叠宽度过渡(现有 CSS transition 可保留,补充列表项出现动画)、Chats 分组展开、登录页卡片入场。
- **zustand**:`workspace-context.tsx` 内部从 React Context 迁移为 zustand store(workspaceId/members/channels/selectedChannel),**对外导出接口(useWorkspacePageContext / useWorkspaceContext / fetchWorkspaces / workspaceKeys)保持不变**,所有消费文件不动。
- **dayjs**:新增 `lib/datetime.ts`(formatDateTime / formatRelativeTime / groupByTimeBucket 等),各页面替换手写日期格式。
- **mermaid**:`mermaid` 包,specs/skills 页 markdown 中 ```mermaid 代码块本地渲染(动态 import + 初始化,dark 主题跟随)。plantuml/c4:```plantuml 块渲染为"在 PlantUML 服务器打开"的编码链接(plantuml-encoder),并注明需自建服务器(MVP 不做本地渲染)。
- **workspace icon**:schema `Workspace.icon String?`(antd icon 名),seed 回填默认 `TeamOutlined`;API createWorkspace 接受 icon。前端预设 icon 列表(~16 个 antd icon),新建/编辑 workspace 时选择;侧边栏折叠态显示 icon。

## 3. 侧边栏折叠重设计(第 1/2 条)

- 折叠态(64px):顶部固定显示**展开按钮**(MenuUnfoldOutlined,始终可见,不在折叠时被隐藏);品牌区显示 logo 缩略;workspace 区显示当前 workspace icon(Tooltip 名称);CHATS 区显示频道 icon(Tooltip 频道名);菜单区 icon 居中,尺寸 18px,点击区域 40px。
- 展开态(280px):折叠按钮 MenuFoldOutlined 在品牌区右侧;现有布局微调。
- 折叠状态持久化(已有 key 复用)。
- 按钮尺寸:icon 按钮 32×32 圆角 8,hover 背景 var(--hover);Tooltip 补充文字说明。

## 4. 视觉 Apple 化(第 4/9 条)

- `globals.css` 增加字号/间距变量:`--font-size-sm: 13px; --font-size-base: 14px; --font-size-lg: 16px; --font-size-title: 20px; --radius-md: 10px; --radius-lg: 16px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px;`(浅/深色一致)。
- 组件字号提升:侧边栏文字 14px、菜单 icon 16-18px、内容区标题层级清晰、次要文字用 --muted。
- 交互:按钮 hover/focus 状态、卡片圆角统一 --radius-lg、留白用 --space 变量。
- 登录/注册页重构(`auth-page.tsx` + `auth-page.module.css`):Apple 风——全屏渐变背景 + 居中毛玻璃卡片(backdrop-filter)、品牌 icon + Wade AI 大标题、输入框更大(高度 44px)、圆角 12、主按钮渐变(primary→#6a8dff)、页脚版权;入场动画(framer-motion fade+up)。

## 5. 文档图表渲染(第 6 条)

- `components/markdown-content.tsx`(新):包装 react-markdown,自定义 `code` 渲染:```mermaid → <MermaidBlock>(动态 import mermaid,`startOnLoad:false` + `mermaid.initialize`),```plantuml → 编码链接卡片(plantuml-encoder 生成 `https://www.plantuml.com/plantuml/svg/<encoded>` 链接,新窗口)。
- specs-page / skills-page 改用该组件。

## 6. Workspace icon(第 8 条)

- 预设列表(常量 `lib/workspace-icons.ts`):TeamOutlined / RocketOutlined / HomeOutlined / BulbOutlined / CloudOutlined / DatabaseOutlined / CodeOutlined / ExperimentOutlined / FireOutlined / GlobalOutlined / HeartOutlined / StarOutlined / TrophyOutlined / AppstoreOutlined / CrownOutlined / CompassOutlined。
- 新建 workspace 弹窗(workspace-navigation)加 icon 选择(grid 单选);编辑 workspace(Settings 页)加 icon 选择。
- 侧边栏 workspace 区、折叠态显示所选 icon。

## 7. 任务拆分(并行 lane)

- **Lane A(后端)**:Workspace.icon schema + db push + createWorkspace/update 接受 icon + 单测。文件:`apps/api/src/{workspace,prisma}`。
- **Lane B(前端-基础/状态)**:zustand 迁移(workspace-context 内部实现)、lib/datetime.ts(dayjs)、framer-motion 基础动画(workspace 内容区/登录页入场)、globals.css 字号变量、auth-page 重构。文件:`workspace-context.tsx`、`lib/datetime.ts`(新)、`app/(workspace)/layout.tsx`、`app/providers.tsx`、`auth-page.tsx`、`auth-page.module.css`、`styles/globals.css`。
- **Lane C(前端-交互/功能)**:侧边栏折叠重设计(展开按钮/icon 尺寸/交互)、字号应用、workspace icon 选择器(新建弹窗/编辑 + 侧边栏显示)、markdown 图表渲染(mermaid/plantuml)。文件:`workspace-navigation.tsx`、`workspace-shell.module.css`、`workspace-pages.module.css`、`components/markdown-content.tsx`(新)、`lib/workspace-icons.ts`(新)、`specs-page.tsx`、`skills-page.tsx`、`settings-page.tsx`、`workspace-page-frame.tsx`。
- 依赖:B 先定 globals 变量与 context 导出兼容;C 的 navigation 用新变量与 icon 字段(契约:Workspace 类型加 icon?: string)。

## 8. 验收

1. lint/typecheck/test(api、web)全过。
2. 浏览器:
   - 折叠后展开按钮始终可见可点;折叠态 icon 大小/间距合理(Tooltip 可用)。
   - 页面切换有淡入动画;登录页新视觉(毛玻璃卡片)正常。
   - specs 页 mermaid 代码块渲染为图(用含 mermaid 的测试 spec 内容验证);plantuml 块显示链接。
   - 新建 workspace 可选 icon,侧边栏显示;编辑 workspace 可改 icon。
   - 全站字号可读性提升(肉眼对比);dayjs 格式化(时间显示格式统一)。
3. AGENTS.md Change Log 追加。

## 9. 不做(后续)

- PlantUML 本地渲染(需 Java 服务);暗色 mermaid 主题切换细节;全局过渡动画库统一替换 antd motion;icon 自定义上传。
