---
name: SPEC-phase13-ux-perf
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 13:UX 布局重构 + 首屏/切页性能优化

## Goal

用户反馈两个问题:
1. **切页迟缓**:首次切换页面有沉重感,感觉加载很多东西(诊断:workspace 登录后 JS 1.8MB / 74 resources;零路由级动态导入,antd 全量 + plantuml-encoder + framer-motion 全部静态打进共享 chunk)。
2. **布局逼仄**:非专业 UX 但感觉页面拥挤(诊断:shell/pages 间距全部 8px/16px 起步,padding 偏小,max-width 未限制导致内容撑满)。

目标:生产构建首屏 JS 体积下降 ≥40%,切页无卡顿;布局留白增加、视觉呼吸感,保持 Apple 暗色风格(用户既有偏好)。

## 约束

- Next.js 16 app router,所有页面 `"use client"`(SPA 工作区)。
- 保持现有功能与 API 契约不变;只动前端表现层与加载策略。
- styled-components 正在推进,但本阶段**不强制迁移**现有 5 个 CSS modules(避免扩大爆炸半径);新样式用 styled-components 或沿用 module.css 均可,保持一致即可。
- 浏览器验收为准:登录 → 工作区 → 逐页切换,无 console error,布局在 1280px/1440px 下舒适。

## 任务

### Task 1:切页性能(首要)

1. **plantuml-encoder 动态化**:`markdown-content.tsx` 中 `import { encode } from "plantuml-encoder"` → 改为 `const { encode } = await import("plantuml-encoder")`(在 PlantUML 渲染分支内按需加载)。mermaid 已是动态,保持。
2. **framer-motion 减负**:
   - `dashboard-page.tsx` 的 `animate/useInView` 数字滚动 → 保留(该页本来就重),但确认其 import 不进首屏。
   - 根 `(workspace)/layout.tsx` 的 `motion.div` 路由切换动画 → 这是每页切换都跑的公共动画,保留但 `transition duration` 0.25s→0.18s,并去掉 `y: 8` 位移(减少 layout 抖动感)。
   - `auth-page.tsx` 的 motion(登录页入场动画)保留,登录页是独立 chunk。
3. **路由级代码分割确认**:检查 11 个 `page.tsx` 是否都被 Next 自动 split;对重页面(dashboard/specs/skills/knowledge)在 page.tsx 用 `next/dynamic` 包裹组件(`ssr: false` 不需要——app router 下用 dynamic 即可),确保这些重页面组件不进首屏共享 chunk。
4. **首屏共享 chunk 瘦身**:
   - `workspace-navigation.tsx`(侧边栏,所有页面共享)检查是否引入重依赖;icons 用 `@ant-design/icons` 按需(已是库内 tree-shake,确认即可)。
   - 若 `antd` 全量引入(检查是否有 `import { Layout } from "antd"` 这种从根导入的多个组件),保持——antd v6 支持 tree-shaking,不引入 babel-plugin-import。
5. **量化验证**:`npm run build` 后读取 `.next/static/chunks` 各 chunk 体积,对比优化前后首屏相关 chunk 总字节,报告降幅。

### Task 2:布局宽松(次要但用户感知强)

1. **间距系统统一上调**(workspace-shell.module.css + workspace-pages.module.css):
   - 侧边栏 padding: `24px 16px` → `28px 20px`;折叠态 8px→12px。
   - 内容区:topbar padding 上调,`--space-lg` 24px→32px,`--space-md` 16px→20px,`--space-sm` 8px→12px(仅全局 token,不逐条改)。
   - 聊天区消息列表与输入框:消息区 max-width 保持 780px 居中;消息间距 12px→16px;Sender 卡片 padding 上调。
2. **页面 frame 留白**:
   - `workspace-page-frame.tsx` 的 `pageStack`:padding 上调(建议 `40px 48px` 起步),`pageHeader` 与内容间距 24px→32px。
   - `pageScrollBody` 内容 max-width 建议 `1100px` 居中(非聊天页),避免 1440px 宽屏下内容拉满。
3. **聊天页细节**:消息区左右 padding、AI 消息气泡与用户消息间距、头像间距微调,更接近 DeepSeek web 的呼吸感。
4. **验收截图**:浏览器 1440px 下逐页截图对比前后。

## Acceptance

- [ ] `npm run lint && npm run typecheck && npm run build` 全绿
- [ ] 生产构建首屏 JS 总字节下降 ≥40%(对比优化前)
- [ ] 浏览器逐页切换无白屏闪烁、无 console error
- [ ] 布局截图:间距明显更宽松,无元素溢出/挤压
- [ ] 功能回归:登录/聊天/AI 流式/文档页 mermaid 渲染正常

## Non-goals

- 不动后端 API、数据模型。
- 不迁移现有 CSS modules 到 styled-components(下阶段再说)。
- 不做暗色/浅色主题重构。
