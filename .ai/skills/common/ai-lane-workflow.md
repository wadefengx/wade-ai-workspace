---
name: ai-lane-workflow
description: 多 Lane 并行开发工作流:Hermes 直接执行,按领域切 lane,harness 验收后回流 memory。
tags:
  - workflow
  - lane
  - sdd
---

# AI Lane Workflow(多 Lane 并行开发)

## 触发

- 一期需求包含多个领域(后端 / 前端基础 / 前端页面 / 文档 / AIOS)。
- 用户要求"全员参与 / 并行开发"。

## 流程

1. **PM 系分**:写 `specs/SPEC-phaseN.md`——目标、范围、不做项、API 契约、验收标准、任务拆分。
2. **切 Lane**:按领域切(后端 / 前端基础 / 前端页面 / Dashboard / AIOS 文档),每个 lane 独占一组文件;跨 lane 共享文件(导航、布局、context)指定单一 owner;契约先定死,并行不联调。
3. **执行**:每 lane 遵守 ponytail(最短实现 / 根因修复);lint/typecheck 逐 lane 过。
4. **QA 验收**(编排者):全量 lint + typecheck + test + build;harness regression 脚本实跑;浏览器逐条验证(登录/刷新恢复/导航/表单/流式/反馈/深色)。
5. **回流**:lessons/decisions 写 `.ai/memory/`;可复用做法沉淀 skill。
6. **Commit**:功能粒度,`feat(scope): 描述`。

## Lane 状态机

`Draft → Ready → Running → Review → QA → Done → Merged`;卡住(多轮无进展)→ `Blocked`。

## 坑

- Prisma schema 变更后 dev server 热重载不可靠 → 手动 `prisma generate` + 重启。
- kill npm wrapper 后子进程残留占端口 → `lsof -ti :PORT | xargs kill -9`。
- 并行 lane 修改同一文件会冲突 → 切 lane 时就锁文件归属。
