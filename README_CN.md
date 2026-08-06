# Wade AI Workspace

**面向团队的 AI-Native Workspace / AI 软件工程操作系统(AIOS)** — 把工作区变成活的软件工厂:多角色专家 Agent、分层记忆、RAG 知识库与团队协作,一个空间全部沉淀。

[English](./README.md) · [Website](https://wadefengx.github.io/wade-ai-workspace/) · [Docs](./docs/architecture.md)

---

## ✨ 核心能力

| 能力 | 说明 |
|---|---|
| 🧠 **专家 Agent** | 无需 `@AI` 即可对话;`@专家名` 路由到指定专家。Agent 带 emoji、角色、描述与可配置 system prompt。 |
| 🔌 **任意 LLM Provider** | 填 API key 即用(DeepSeek / OpenAI / Anthropic / 任意 OpenAI 兼容端点)**或**接本地模型(Ollama)。Workspace 级默认 Agent、provider 一键预设、连接测试。 |
| 📚 **RAG 知识库** | 上传文档 → 递归切片(512 token,15% overlap)→ Embedding → 向量检索。**内容 hash 去重**避免重复切片;回答以 `[^n]` 上标引用来源。 |
| 🗂️ **分层记忆 L0→L3** | 对话 → 原子事实 → 场景 → 用户画像,单次 LLM 结构化抽取。渐进式披露:画像/场景引导召回,原子事实按需下钻。借鉴 TencentDB Agent Memory。 |
| 👥 **团队与 RBAC** | Workspace、频道、成员管理;全局管理员与 Workspace 角色(OWNER > ADMIN > MEMBER)双体系。 |
| 📊 **仪表盘** | AI 组织总览、反馈看板、Specs 与 Skills 浏览。 |

## 🏗️ 技术栈

| 层 | 栈 |
|---|---|
| 前端 | Next.js 16 · React 18 · TypeScript · Ant Design X · styled-components |
| 后端 | NestJS · Prisma · MongoDB(replica set) |
| AI | OpenAI 兼容 Provider 抽象 · Anthropic · Ollama(可选本地)· EmbeddingService(API + 本地回退) |
| 基础设施 | Docker Compose · Swagger(`/api/swagger`) |

## 🚀 快速启动

```bash
cp .env.example .env
docker compose up --build
```

首次启动会初始化 MongoDB replica set、推送 Prisma schema、写入演示工作区,并(可选)拉取本地 Ollama 模型。

- Web: http://localhost:3000
- API 健康检查: http://localhost:3001/api/health
- Swagger: http://localhost:3001/api/swagger

### 测试账号

| 账号 | 密码 | 角色 | 说明 |
|---|---|---|---|
| admin@wade.local | admin | 全局管理员 | 最高权限,可查看所有 Workspace 与数据 |
| alice@wade.local | password123 | OWNER(Team Alpha) | 主演示账号,含种子数据 |
| bob@wade.local | password123 | MEMBER(Team Alpha) | 权限隔离演示 |

### 常用命令

```bash
docker compose down            # 停止并保留数据
docker compose logs -f api web # 查看日志
docker compose down -v         # 重置所有数据(不可恢复)
docker compose exec api npm run prisma:push   # 应用 schema
docker compose exec api npm run prisma:seed   # 重新播种演示数据
```

## 🧠 使用 AI

1. **选 LLM**:打开 **Agents** → 选预设(DeepSeek/OpenAI 自动填 baseUrl + model)→ 粘贴 API key → **测试连接**;或选 Ollama 用本地模型。
2. **设默认 Agent**:Workspace 设置里选择默认回复的 Agent。
3. **对话**:直接输入即可。Workspace Agent 回复;`@专家` 路由到该专家;命中知识库时以 `[^n]` 标注引用。
4. **上传知识**:**Knowledge** 页上传文档 → 自动切片 + Embedding;重复上传同内容文件通过 hash 跳过。
5. **见证记忆生长**:消息累积后触发**抽取**(或自动执行)——频道对话被蒸馏为 L1 原子事实、L2 场景、L3 画像,沉淀在 **Memory** 页。

## 🗂️ Monorepo 结构

```text
apps/
  web/    Next.js 16 前端(App Router,AntD X,styled-components)
  api/    NestJS API(Prisma + MongoDB,AI providers,RAG,记忆管线)
specs/    SDD 规格 — 每个 Phase 先写 SPEC 再写代码(Phase 6 → 16)
docs/     架构与 API 契约笔记
infra/    docker-compose、容器初始化
skills/   AI 协作技能(Runtime Operating Model v2)
```

## 🧭 演进历史(Spec-Driven)

每个 Phase 都是 spec 先行:`specs/SPEC-phaseNN-*.md` 在实现前编写并批准。

- **Phase 6-13** — 团队 Workspace、频道、AI 流式对话、知识库 RAG、RBAC、仪表盘、UX/性能重构(首屏 JS 1.8MB → 598KB)
- **Phase 14** — 专家 Agent(emoji/角色/描述/预设)、无 @AI 默认对话、去掉 `#` 前缀
- **Phase 15** — LLM Provider 化:EmbeddingService(API + 本地回退)、内容 hash 去重、递归切片、解耦 Ollama
- **Phase 16** — 分层记忆 L0→L3(TencentDB 思路)、Workspace 级默认 Agent、RAG 引用标注、Provider 一键预设

## 🧑‍💻 开发

```bash
npm install
npm run dev:web      # 前端 :3000
npm run dev:api      # API :3001
npm run typecheck && npm run lint && npm test
```

## 🤝 相关项目

- [wade-ai](https://github.com/wadefengx/wade-ai) — AI 协作实践知识库(ponytail 哲学 + AI-Native 开发体系),在其他项目驱动 AI 前建议先读。

## License

MIT
