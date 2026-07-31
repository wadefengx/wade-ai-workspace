# Wade AI Workspace 终极实施计划

版本：0.1

## 1. 产品定位

Wade AI Workspace 是一个面向团队协作的 AI Native Workspace。它不是 Slack 的复刻，也不只是一个聊天机器人；它要把人类讨论、AI 协作、知识文档与可复用记忆沉淀在同一个工作空间中。

核心闭环：

```text
人类讨论 -> AI 理解与协作 -> 知识提取/记忆沉淀 -> 后续会话自动获得上下文
```

长期目标是形成团队的“AI Brain”：成员与 Agent 不仅能在频道中协作，还能基于团队知识和记忆持续提高回答质量。

## 2. MVP 边界

### 必须交付

- 用户注册、登录、会话管理。
- Workspace 创建、成员查看与加入机制。
- Channel 创建及频道内消息历史。
- 基础实时聊天：人类消息发送、接收与展示。
- `@AI` 触发 Agent 回答，支持 Markdown 与流式输出。
- OpenAI-compatible Provider：首期兼容 OpenAI、DeepSeek、Ollama。
- 知识库上传与检索：`.md`、`.txt`、`.pdf`。
- 三层 Memory：个人、团队、项目。
- 默认聊天 Agent，以及可扩展的 Provider/Engine 抽象。

### 明确不做

- 视频/语音聊天。
- 复杂企业级 RBAC、审批流与工作流编排。
- 完整 Slack 协议兼容。
- Agent Marketplace。
- 自主多 Agent 任务执行、Planner、反思循环。
- 生产级评测平台与 CI Quality Gate。

## 3. 技术决策

### 前端

| 范畴       | 选择                               | 决策理由                                                |
| ---------- | ---------------------------------- | ------------------------------------------------------- |
| 框架       | Next.js 16 + React 19 + TypeScript | 负责前端工作台与服务端渲染。                            |
| 企业组件   | Ant Design 6                       | 表单、表格、状态、配置页和后台管理能力成熟。            |
| AI 交互    | Ant Design X                       | 用于 Conversation、Bubble、Sender、Prompts 等聊天体验。 |
| 样式       | CSS Variables + CSS Modules        | 不使用 Tailwind/shadcn；保留可控的视觉定制空间。        |
| 客户端状态 | Zustand                            | 管理局部 UI 状态、聊天草稿和工作台交互状态。            |
| 服务端数据 | TanStack Query                     | 缓存、失效、请求状态和 mutation 管理。                  |

### 后端与数据

| 范畴     | 选择                                                               | 决策理由                                                              |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 服务端   | NestJS                                                             | 提供模块化 BFF/API、鉴权、SSE、异步任务编排和后续 WebSocket 能力。    |
| 数据库   | 本地 MongoDB Community 7（Docker Compose）                         | 所有数据与开发流程先在本机闭环；使用 replica set，兼容 Prisma 事务。  |
| ORM      | Prisma                                                             | 统一业务集合的 schema、类型和数据访问；不在 MVP 中保留 Drizzle 选项。 |
| 向量检索 | 本地应用层余弦相似度 Top-K                                         | MVP 无云服务依赖；以清晰的规模上限换取可本地验证的 RAG 闭环。         |
| 文件存储 | 本地文件系统 `data/uploads`                                        | 上传、提取和删除均在本机完成，不依赖 S3 或对象存储。                  |
| 实时能力 | NestJS SSE 流式 AI 回复；多人消息后续使用 NestJS WebSocket Gateway | 将 AI token 流和协作消息广播解耦，同时保持服务端实现集中。            |

### UI 设计原则

- 主色为 `#024AD8`，通过 Ant Design `ConfigProvider` 统一 token，基础圆角为 `8px`。
- AntD 负责控件行为、数据密度和可访问性；自定义布局、间距、排版、动效与 AI Context 氛围，避免默认企业后台观感。
- 目标气质：清爽、紧凑、适合长时间工作的 AI Workspace；参考 Linear、Notion、Alma，而不是营销站或 Slack 的直接复制。
- 不以卡片堆叠替代信息层级。工作台应优先支持扫描、连续操作与上下文切换。

### 本地运行原则

- MVP 不部署线上服务，不依赖 MongoDB Atlas、对象存储、托管队列或云端实时服务。
- 整个项目只能通过 Docker Compose 启动；不要求本机安装 Node.js、MongoDB、Ollama 或其他运行时服务。
- Compose 默认编排 `web`、`api`、`mongodb`、`mongo-init`、`ollama` 与 `ollama-init`：前端、NestJS API、数据库、replica set 初始化、本地模型服务与模型拉取均运行在容器中。
- MongoDB 使用单节点 replica set；数据库、上传文件和 Ollama 模型均挂载命名 volume，容器重启后保留数据。
- 开发镜像挂载源码并启用 Web/API 热更新；文档解析任务由 API 容器执行，上传文件写入共享的 `uploads` volume。
- 默认使用 Compose 内部的 Ollama；仅在显式配置时允许 API 读取 `.env` 中的兼容远程模型地址和密钥。
- 本地 RAG 仅适用于小规模验证：知识 chunk 数量设置上限，检索使用内存中的余弦相似度计算。上线前再迁移至 MongoDB Atlas Vector Search 或专用向量数据库。

### Docker Compose 拓扑与约定

```text
browser -> web:3000 -> api:3001 -> mongodb:27017
                         |-> ollama:11434
                         |-> uploads volume

mongo-init: 初始化 MongoDB replica set 后退出
ollama-init: 拉取聊天与 embedding 模型后退出
```

- 统一命令：`docker compose up --build`；首次启动会初始化 replica set、执行 Prisma `db push`/seed，并拉取配置的 Ollama 模型。
- 停止但保留数据：`docker compose down`；完全重置：`docker compose down -v`。重置命令必须在 README 中明确标注会删除本地数据库、上传文件和模型缓存。
- 提供 `.env.example`，包含端口、MongoDB 数据库名、JWT secret、Ollama 模型名、上传大小上限和可选的远程 Provider 配置；真实 `.env` 不提交。
- 所有服务必须定义 healthcheck。`api` 仅在 MongoDB replica set 可用且初始化完成后启动；`web` 仅在 API health endpoint 可用后启动。
- macOS 默认使用 CPU 运行 Ollama；GPU 映射只作为 Linux/NVIDIA 的可选 Compose override，不作为 MVP 前提。

## 4. 信息架构与核心界面

### 工作台布局

```text
┌──────────────────────────────────────────────────────────────┐
│ Workspace Header: 工作区切换、成员、通知、账户                 │
├───────────────┬──────────────────────────────┬───────────────┤
│ 左侧导航       │ 中间会话区                    │ 右侧 AI Context │
│ Workspace     │ 当前频道消息 / AI 流式回答     │ 当前 Agent      │
│ Channels      │ 输入框、@AI、引用与快捷提示    │ 已注入 Memory   │
│ Knowledge     │                                │ 关联 Knowledge  │
│ Memory        │                                │ 模型/引擎状态   │
│ Agents        │                                │                 │
│ Settings      │                                │                 │
└───────────────┴──────────────────────────────┴───────────────┘
```

### 页面范围

1. 认证页：注册、登录、退出与会话恢复。
2. Workspace 首页：频道导航、当前频道会话与 Context 面板。
3. Knowledge：上传、索引状态、文档列表、重建索引、删除。
4. Memory：个人/团队/项目记忆浏览、创建、编辑、删除与启用状态。
5. Agents：默认 Agent 配置、模型 Provider、能力开关；首期仅支持一个 Default Chat Engine。
6. Settings：工作区基本信息、成员列表和成员角色。

## 5. 领域模型与数据表

所有业务数据必须带 `workspaceId`，服务端任何读写均应先做成员资格校验。

### 用户与协作

```text
users
- id
- name
- email (unique)
- passwordHash / externalAuthId
- avatarUrl
- createdAt
- updatedAt

workspaces
- id
- name
- createdBy
- createdAt
- updatedAt

workspace_members
- id
- workspaceId
- userId
- role: OWNER | MEMBER
- createdAt

channels
- id
- workspaceId
- name
- createdAt
- updatedAt
```

### 消息与 Agent

```text
messages
- id
- workspaceId
- channelId
- senderType: USER | AGENT
- senderId
- content
- status: PENDING | STREAMING | COMPLETED | FAILED
- replyToMessageId (optional, MVP 可不做 UI)
- createdAt
- updatedAt

agents
- id
- workspaceId
- name
- engineType
- providerConfigRef
- capabilitiesJson
- isDefault
- createdAt
- updatedAt
```

### 知识与记忆

```text
knowledge_documents
- id
- workspaceId
- filename
- mimeType
- storageKey
- extractionStatus: PENDING | PROCESSING | READY | FAILED
- extractedContent
- errorMessage
- createdBy
- createdAt
- updatedAt

knowledge_chunks
- id
- documentId
- workspaceId
- content
- chunkIndex
- embedding: Float[]
- createdAt

memories
- id
- workspaceId
- userId (PERSONAL 必填，其他类型为空)
- type: PERSONAL | TEAM | PROJECT
- content
- sourceMessageId (optional)
- confidence (optional)
- enabled
- createdBy
- createdAt
- updatedAt
```

建议的普通索引：`workspace_members(workspaceId, userId)`、`channels(workspaceId)`、`messages(channelId, createdAt)`、`knowledge_chunks(workspaceId, documentId)`。

`knowledge_chunks.embedding` 保存为浮点数组。Prisma 负责常规 CRUD；`KnowledgeRepository` 读取当前 workspace 的候选 chunk，在 NestJS 进程内计算 cosine similarity 并返回 Top-K。该实现故意只服务于本地 MVP：必须限制单个 workspace 的 chunk 数量和单次候选集大小。未来接入 Atlas 后，将此 Repository 替换为带 `workspaceId`、`documentId` 过滤条件的 `$vectorSearch` 查询，调用方无需改变。

## 6. 架构边界与目录

```text
apps/
├── web/                    # Next.js 前端
│   └── src/
│       ├── app/            # 路由与页面，不承载业务 API
│       ├── components/
│       ├── features/
│       ├── theme/antd.ts
│       └── styles/globals.css
└── api/                    # NestJS 后端
  └── src/
    ├── auth/
    ├── workspace/
    ├── chat/
    ├── knowledge/
    ├── memory/
    ├── agents/
    ├── ai/             # providers、engines、prompts、retrieval
    ├── prisma/         # PrismaService、schema 与数据访问基线
    ├── repositories/   # 本地向量检索等非 Prisma 查询
    └── common/         # guard、filter、config、DTO
```

依赖方向：`web app/components -> web features -> NestJS API -> domain service/repository -> Prisma/MongoDB`。前端不直接访问数据库；NestJS controller 不直接包含领域编排；Provider 与 Agent Engine 不依赖前端页面组件。

## 7. AI 契约与上下文策略

### Provider 抽象

```ts
export interface AIProvider {
  chat(input: ChatInput): Promise<ChatResult>
  stream(input: ChatInput): AsyncIterable<ChatStreamEvent>
}
```

Provider 负责模型调用、鉴权、错误归一化和 token 流；不负责工作区权限、消息持久化或 RAG 拼装。

### Engine 抽象

```ts
export interface AgentEngine {
  execute(input: AgentExecutionInput): Promise<AgentExecutionResult>
  stream(input: AgentExecutionInput): AsyncIterable<AgentExecutionEvent>
  getCapabilities(): AgentCapability[]
}
```

MVP 只实现 `DefaultChatEngine`。Engine 负责：读取近期频道消息、检索工作区知识、选择可用 Memory、调用 Provider，并把流式事件提供给 NestJS SSE Controller。

### 请求流程

```text
用户发送 @AI 消息
-> 校验 workspace 成员资格
-> 保存用户消息
-> 组装近期聊天 + 可用 Memory + Top-K Knowledge chunks
-> DefaultChatEngine 调用 AIProvider.stream
-> NestJS SSE 返回 token
-> 增量保存/最终保存 Agent 消息
-> 广播完成事件
```

### 上下文控制

- 只注入当前 workspace 可见的数据，Personal Memory 仅对其所属用户可见。
- Memory 按类型、启用状态与相关度筛选；首期可采用规则排序，后续再引入 embedding 检索。
- Knowledge 使用本地余弦相似度的文档 chunk Top-K 检索，并在回答中保留可追溯的文档引用元数据。
- 不把完整频道历史和全部知识库直接拼入 prompt；必须设置消息数量、token 和 Top-K 上限。

## 8. API 与权限原则

核心 API 以 workspace 为授权边界：

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:workspaceId/members

GET    /api/workspaces/:workspaceId/channels
POST   /api/workspaces/:workspaceId/channels
GET    /api/channels/:channelId/messages?cursor=
POST   /api/channels/:channelId/messages
POST   /api/channels/:channelId/ai/stream

GET    /api/workspaces/:workspaceId/knowledge
POST   /api/workspaces/:workspaceId/knowledge
POST   /api/knowledge/:documentId/reindex
DELETE /api/knowledge/:documentId

GET    /api/workspaces/:workspaceId/memories
POST   /api/workspaces/:workspaceId/memories
PATCH  /api/memories/:memoryId
DELETE /api/memories/:memoryId
```

- 认证由 NestJS 签发和校验的 session/JWT 负责，浏览器不保存数据库访问凭据或 Provider 密钥。
- 每个 workspace 路由先验证登录，再验证成员关系；写操作按 OWNER/MEMBER 的最小权限定义。
- 上传需校验 MIME、大小、文件名，并异步执行提取与向量化。
- Provider 密钥只保留在服务端环境变量或受控 secrets 中。

## 9. 分阶段实施计划

### Phase 0：架构确认与工程基线

目标：冻结关键决策，避免在业务开发中切换框架。

- 初始化 monorepo、Next.js 16、React 19、TypeScript、Ant Design 6、Ant Design X 与 NestJS。
- 提供完整 Docker Compose：Web、API、MongoDB Community 7 单节点 replica set、Mongo 初始化、Ollama、模型初始化与持久化 volumes。
- 为 Web/API 制作开发 Dockerfile，挂载源码并支持容器内热更新；提供生产 Dockerfile 仅作后续部署准备，不在 MVP 发布。
- 配置 Prisma MongoDB Provider、Compose 内部连接字符串、schema 推送流程与种子数据。
- 配置共享 `uploads` volume；不使用宿主机 `data/uploads` 作为运行时依赖。
- 在 README 中写明启动、停止、查看日志、重置数据、执行 Prisma 操作和切换 Ollama 模型的 Docker 命令。
- 建立 ESLint、格式化、单测和最小 e2e 骨架。
- 建立主题 token、全局样式与应用外壳。
- 写入 `docs/architecture.md`、`docs/database.md`、`docs/api-contracts.md`。

验收：执行 `docker compose up --build` 后，所有服务均健康；浏览器可访问 Web，Web 可调用 API，API 可连接 MongoDB 与 Ollama；Prisma 可将 schema 推送至空 MongoDB；上传 volume 可读写；CI 能跑 lint、typecheck、单测。

### Phase 1：身份与 Workspace

目标：用户能进入受保护的工作区。

- 注册、登录、登出、session 恢复。
- 创建 workspace，创建者自动成为 OWNER。
- 成员模型与成员列表。
- 创建默认 `general` channel，创建/选择 channel。
- 工作台左侧导航与空频道状态。

验收：两个用户可以登录；Owner 创建 workspace；成员只能访问加入的 workspace；用户可切换频道。

### Phase 2：持久化聊天与实时基础

目标：频道成为可靠的协作载体。

- 消息发送、列表、游标分页与时间排序。
- 乐观更新、失败回滚、加载/空态/错误态。
- 建立消息广播抽象；首期可先以刷新/轮询验证，后接实时服务。
- 设计 `USER`、`AGENT` 消息渲染与状态机。

验收：两个浏览器会话可看到同一频道的消息；刷新后历史不丢失；无权限用户无法读取消息。

### Phase 3：Default Chat Agent 与流式回答

目标：`@AI` 可基于频道上下文稳定回答。

- 实现 `AIProvider`、OpenAI-compatible Provider 和 `DefaultChatEngine`。
- 实现 NestJS SSE endpoint、流式渲染、取消与失败状态。
- 仅在消息含 `@AI` 时触发 Agent；保存用户/Agent 消息。
- Markdown 安全渲染、代码块、引用/错误展示。
- 引入最小 prompt 模板与 token 限制。

验收：支持配置 OpenAI、DeepSeek 或 Ollama；AI 回复逐 token 展示；刷新后 Agent 回答保留；Provider 异常能显示可理解的失败状态。

### Phase 4：Knowledge Base 与 RAG

目标：AI 能引用工作区上传资料回答问题。

- 文件上传至本地目录、进程内解析任务与索引状态。
- `.md`、`.txt`、`.pdf` 的文本提取、分块、embedding 与 MongoDB `Float[]` 写入。
- 使用应用层 cosine similarity 执行当前 workspace 内的 Top-K 检索，并限制候选 chunk 数量。
- 文档列表、进度、失败原因、重试、删除与重建索引。
- 在 Engine 中执行 Top-K 检索并注入引用块。

验收：上传一个支持的文档后可看到 `READY`；提问能得到基于文档的回答与来源；失败文档可重试；删除后不可再检索。

### Phase 5：Memory 闭环

目标：团队上下文可被控制地积累和复用。

- Personal、Team、Project 三类 Memory 的 CRUD。
- 从用户手动确认开始，避免 MVP 自动写入噪声记忆。
- 在 Agent 请求前按权限和相关度注入记忆。
- 提供 Memory 来源、启用/禁用与删除能力。

验收：用户可管理三类记忆；Personal Memory 不泄露给其他用户；禁用或删除后不会被注入；回答能体现选中的相关记忆。

### Phase 6：Agent 配置与可观测性

目标：为后续多引擎演进预留稳定边界。

- Agent 列表、默认 Agent、Provider/模型配置、能力展示。
- 记录 AI 请求耗时、token、Provider 错误和检索命中，不记录敏感原始密钥。
- 为 Provider、Engine、RAG 和 Memory 建立单元测试与集成测试。

验收：可以在不改聊天 UI 的情况下切换 Provider；出现请求失败时可定位 provider、engine 或 retrieval 阶段。

## 10. 测试与质量门槛

- 纯函数、Provider 适配、Engine 上下文组装、权限服务必须有单元测试，目标行覆盖率不低于 90%。
- Chat、上传、RAG、Memory 权限至少各有一个集成测试。
- 关键用户路径至少有 e2e：注册/登录、创建 workspace、发送消息、`@AI` 流式回复、上传文档并检索。
- 流式接口测试必须覆盖正常结束、取消、Provider 失败和持久化失败。
- 文档解析与 embedding 必须可重试、可观测，并避免单次失败阻断聊天。
- 所有 Prisma schema 变更必须有本地 `db push` 操作说明、兼容性策略与回滚说明；本地 MongoDB 初始化脚本与上传目录约定必须提交到仓库。

## 11. 主要风险与前置决策

1. 认证方案：在 Phase 0 确定 NestJS Passport + JWT/refresh token、session，或外部身份服务。前端只负责 token/session 使用，不承担鉴权业务逻辑。
2. 实时服务：SSE 用于 AI token；本地多窗口消息同步可先使用轮询，后续再接入 NestJS WebSocket Gateway。
3. PDF 提取与异步任务：MVP 使用进程内任务并持久化状态；长任务、失败重试和服务器重启恢复是后续队列化的前置风险。
4. Embedding Provider：应与聊天模型 provider 解耦；本地优先使用 Ollama embedding model，远程模型仅通过本地环境变量配置。
5. 本地向量检索规模：应用层余弦相似度不适合大规模 chunk；必须设置每个 workspace 的文档、chunk 和候选集上限。
6. 数据隔离：RAG 查询、Memory 注入、文件下载都必须以 workspace/member 权限作为第一道约束。
7. 数据删除：文档删除需级联删除本地文件、chunk 与 embedding；用户/工作区删除策略应在上线前定义。

## 12. 后续路线图

在 MVP 已稳定运行、真实用户产生足够会话与文档数据后再进入以下方向：

- Agent Runtime：Planner、Tool Calling、任务执行、Reflection Loop。
- 多 Agent：Frontend、Backend、QA、Research 等专用 Agent。
- Engine Adapter：Hermes、Claude Code、OpenClaw、Custom Engine。
- 更完善的成员邀请、角色和企业权限体系。
- Harness Engineering：黄金数据集、离线评测、LLM Judge、回归基准、CI 质量门禁。
- Agent/Provider Marketplace 与插件生态。

## 13. 首次执行顺序

实施不应一次性生成全量代码。建议严格遵循以下节奏：

1. 先完成 Phase 0 的架构提案、依赖选择和数据模型评审。
2. 审核通过后只实施一个 Phase。
3. 每个 Phase 完成后运行对应测试、迁移和验收路径。
4. 对真实用户反馈和错误数据做复盘，再进入下一 Phase。

本计划是 MVP 的实施基线。任何新增模块应先说明其是否服务于“人类 + Agent + Knowledge + Memory”的核心闭环；若不能直接服务该闭环，则放入后续路线图。
