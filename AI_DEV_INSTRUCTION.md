# AI-Native 开发体系 Instruction(通用模板)

> 本文件是 Wade AI 项目沉淀出的 **AI-Native 开发体系**通用提取版。任何新项目启动时,直接读取本文件即可快速搭建 AI 配置、开发团队与迭代流程。**不依赖具体项目背景**。
> 配套使用:ponytail 哲学(最短可行实现 / YAGNI / 根因修复)。

---

## 1. 核心思想

- **AI-first,人定目标**:人是 Supervisor,AI 是生产力。需求由人提出,spec 驱动,agent 执行,人验收。
- **Spec 是唯一真相源**:实现前必须有 spec;代码/文档/对话与 spec 冲突时,以 spec 为准并回写 spec。
- **一切沉淀回流**:每个完成的任务必须回流 `memory`(经验/决策/教训)→ `skill`(可复用能力)→ `knowledge`(参考),让 AI 越用越强,下个任务不重复踩坑。

## 2. 新项目启动步骤(15 分钟)

1. `git init -b main` + 写 `.gitignore`(node_modules/.next/dist/.env/上传目录)。
2. 把本文件复制为 `AGENTS.md`(或保留本文件并在 AGENTS.md 引用它),按项目实际改 Mission 与目录索引。
3. 创建 `.ai/` 目录骨架(见 §4;可直接从本仓库复制)。
4. 配置依赖镜像源(见 §7,中国网络环境)。
5. 写第一个 `specs/SPEC-001.md`(模板见 §4)→ 开发 → harness 验收 → commit。

## 3. 每期需求迭代流程(SDD)

```text
需求提出 → PM 功能系分(范围/边界/不做项)
→ 架构设计(PM+前端+后端:路由/契约/数据模型/权限)
→ 任务拆分(PM:按领域拆 lane,保证文件不冲突)
→ 并行开发(每 lane 独立,遵守 ponytail)
→ QA 验收(单测 + harness regression + 浏览器实测)
→ 回流(lessons/decisions 写 memory,通用做法沉淀 skill)
→ git commit
```

**Lane 切分原则**:按领域(后端/前端基础/前端页面/文档/QA)切,每个 lane 独占一组文件;跨 lane 共享文件(如导航/布局)指定单一 owner;契约先定死(spec 里写清 API 签名),并行不联调。

## 4. AIOS 组织层(.ai/ 目录)

```text
.ai/
├── organization/     # AI 如何协作:constitution(五大对象模型)/team/roles/*/routing/topology
├── runtime/          # AI 如何运行:pipeline(标准执行管线)/model-routing/tool-policy/coding-policy
│                     #   + planner(需求→Epic→Story→Task→Lane)/lane-states(状态机)/confidence(置信度)
├── workflows/        # 可复用流程:feature/bugfix/refactor/release/architecture/research/review
├── registry/         # 运行时索引(关键!):skills.yaml/workflows.yaml/models.yaml/tools.yaml/roles.yaml
│                     #   —— AI 先查 registry,不扫目录
├── specs/            # TEMPLATE.md + active/ + completed/ + archived/(frontmatter 带 status)
├── skills/           # 可复用技能(common/frontend/backend/...),frontmatter 带 metadata
├── memory/           # 长期记忆(architecture/engineering/product/bug/lessons/glossary 分类)
├── knowledge/        # 被动参考(business/product/engineering/framework/references)
├── architecture/     # overview/tech-stack/modules/api-contract + adr/ADR-xxx.md
├── harness/          # AI 质量系统:regression 脚本/golden case/evals/scorecards(AI CI)
└── changelog/        # 历史归档
```

**五大对象模型**(写进 constitution):
`Organization(协作) → Specification(做什么) → Workflow(怎么做) → Knowledge(知道什么) → Runtime(如何执行)`;`Memory / Skill / Harness` 是贯穿生命周期的三系统。

**Spec 模板要点**:Background / Goal / Scope / Non-goals / UX / API 契约 / Database / Acceptance Criteria / Risks / Tasks / QA Checklist;frontmatter 带 `status: draft|approved|implementing|testing|done`。

## 5. 团队与 Lane 运行机制

- **角色**:PM / Architect / UX / 前端 / 后端 / QA,各角色有自己的 `.ai/organization/roles/*.md`(使命/职责/输入/输出/边界/DoD)。
- **执行模式**:编排者(Hermes 类 agent)负责拆 lane、派发、监控、验收;多 lane 并行,QA 最后统一验收。
- **Lane 状态机**:`Draft → Ready → Running → Review → QA → Done → Merged`,卡住(多轮无进展)→ `Blocked`。
- **Confidence 机制**:每个 lane 带置信度(实现完整性/测试覆盖/契约符合度打分);`<0.7` 自动 Architect Review,`<0.5` 外部 review。
- **Review 是流程不是聊天**:Lane → Code → Self Review → Harness 跑分 → Memory 更新 → Merge 决策。
- **Memory → Skill 晋升**:Lesson 积累 → Skill Candidate → Architect Review → Promote(组织学习)。

## 6. 工程质量门禁(每期必须全绿)

1. `lint` + `typecheck` + `test`(单元)+ `build`(生产构建)。
2. **Harness regression**:关键流程有可执行验收脚本(如 `verify-phaseN.sh`),PASS/FAIL 计数,退出码;每个重要 workflow 一个 harness 目录。
3. **浏览器实测清单**:核心用户路径逐条验证(登录/刷新恢复/导航/表单/流式/反馈/深色模式)。
4. 测试账号固化在 README;错误消息用中文(除非 spec 另有规定)。

## 7. 中国网络环境配置

- npm → `https://registry.npmmirror.com`;GitHub 加速 → `gitclone.com`;Docker Hub 不可用 → `quay.io`;MongoDB 二进制 → `fastdl.mongodb.org`;本地大模型 → Ollama(ClashX `127.0.0.1:7890` 代理)。
- 工具统一 Homebrew 管理;反对 npm global 安装。

## 8. 常用工程约定

- **Ponytail 哲学**:最短可行实现;复用 > 新建;根因修复(一处 guard 优于每个调用点打补丁);不建无用的抽象。
- **前端**:SPA 统一 layout + 状态管理用 zustand;时间处理 dayjs;动画 framer-motion;组件优先用已装 UI 库(antd / antd-x)。
- **后端**:NestJS 风格模块化 + Swagger 文档;DTO 校验;错误消息中文。
- **提交**:功能粒度 commit,message 用 `feat(scope): 描述`。
- **运维坑**:kill npm wrapper 后子进程会残留占端口 → `lsof -ti :PORT` 清理;dev server 热重载对 schema 变更不可靠 → 改 Prisma schema 后手动 `prisma generate` + 重启。
- **Dev 环境**:统一启动脚本 + README 记录(服务清单、端口、账号)。

---

*本文件由 Wade AI(ai-workspace)项目实践沉淀,可自由复制到任何新项目按 §2 使用。*
