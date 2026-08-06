# 架构(当前)

## 边界

- **前端**(`apps/web`,Next.js 16 App Router):页面呈现、会话状态、API 调用;不直接访问数据库。
- **后端 API**(`apps/api`,NestJS):认证、Workspace/频道/消息/Agent/知识库/记忆;客户端访问数据的唯一入口。
- **数据库**:MongoDB(replica set,Prisma ORM);保存用户、Workspace、消息、Agent、知识 chunk、分层记忆。
- **AI 层**:Provider 抽象(OpenAI-compatible / Anthropic / Ollama),Agent 引擎 + EmbeddingService,全部通过 API 服务端调用,密钥只存服务端。

## 拓扑

```text
Browser (Next.js :3000)
   │ HTTP / SSE
   ▼
API (NestJS :3001) ──► MongoDB (replica set)
   │
   ├─► OpenAI-compatible / Anthropic / Ollama (LLM, API key 或本地)
   └─► EmbeddingService (API embeddings + 本地回退)
```

- Docker Compose 编排:`web` / `api` / `mongodb` / 可选 `ollama`。
- API 依赖 `mongodb` 健康(Phase 15 起**不依赖 ollama**,默认 Agent 为 OPENAI_COMPATIBLE)。
- SSE 流式对话:`POST /channels/:id/ai/stream`,事件含 `token` / `citations` / `done` / `error`(Phase 16:回答带 `[^n]` 引用)。

## AI 对话链路

1. 前端 POST 消息 → `chat.service` 建 Message(PENDING)。
2. `streamAgentReply`:**workspace.defaultAgentId** 优先,否则 ensureDefaultAgent(OPENAI_COMPATIBLE)。
3. `default-chat.engine.buildPromptMessages`:检索 KnowledgeChunk(embedding 余弦,失败降级空上下文)+ 注入分层记忆(L3 画像 + L2 场景 topK)。
4. Provider stream → SSE token 事件 → 前端渲染;`citations` 事件携带引用列表。

## 记忆管线(Phase 16,TencentDB-Agent-Memory 思路)

```text
频道消息 (L0)
   │ extractFromConversation(单次 LLM JSON 抽取,≥20 条触发或手动)
   ▼
L1 原子事实 ──embedding 余弦 >0.92 去重──► L2 场景聚合 ──► L3 画像
   └── sourceMessageIds 溯源链(可下钻原始对话)
```

- 抽取失败全降级,不阻塞对话。
- 渐进式披露:画像全量(小)+ 场景按相关度 topK + 原子事实按需下钻。

## 目录结构

```text
apps/
  web/    Next.js 16 前端(App Router,AntD X,styled-components)
  api/    NestJS API(prisma/, ai/providers/, ai/engines/, knowledge/, memory/)
specs/    SDD 规格(Phase 6 → 16,spec 先行)
docs/     本目录(架构/数据库/API 契约)
infra/    docker-compose、容器初始化
website/  官网 landing(GitHub Pages 部署)
```

## 演进原则

1. Spec-Driven:每个 Phase 先写 `specs/SPEC-phaseNN-*.md` 并批准,再写代码。
2. API Key 只写不回;Embedding/RAG 失败降级不 500。
3. Provider 抽象:LLM 可 API key 或本地,Workspace 级可切换(AnythingLLM 思路)。
