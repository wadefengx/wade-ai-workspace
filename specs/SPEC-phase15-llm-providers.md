---
name: SPEC-phase15-llm-providers
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 15:LLM Provider 化(API key + 本地)+ RAG 去重

## Goal

用户诉求:
1. **不用 ollama 作为唯一 LLM**:支持 **API key 接入**(OpenAI-compatible/DeepSeek/Anthropic 等)+ **本地部署**(ollama),两者并存。不假设每个人的电脑都装了 ollama。
2. **文档 RAG 持久化到 DB,避免重复切片**:文档 reindex 时用内容 hash 去重,内容没变就跳过,不重复 embedding/切片。

## 现状(已勘察)

**已有(精华,保留)**:
- Agent 模型已支持 `type: OLLAMA | OPENAI_COMPATIBLE | ANTHROPIC | OPENCLAW | HERMES` + providerConfigRef(baseUrl/apiKey/model),engine 按 type 选 provider ✅
- RAG 骨架:KnowledgeDocument + KnowledgeChunk(embedding Float[])、splitIntoChunks、searchSimilarChunks 余弦相似度 ✅
- default-chat.engine buildPromptMessages 已检索相似 chunks 注入上下文 ✅
- Agents 页 6 预设(OpenAI/DeepSeek/Ollama/Claude/OpenClaw/Hermes)✅

**糟粕(要改)**:
1. **embedding 锁死 ollama**:knowledge.service 和 default-chat.engine 直接调 `ollamaService.embed()`——没有 ollama 就整个 RAG 挂掉。
2. **重复切片**:reindex 无条件 `deleteMany` + 全量重建,无内容 hash 去重。
3. **默认 Agent 依赖 ollama**:seed 默认 agent 指向 ollama;无 ollama 环境对话/RAG 都不可用。
4. **OPENAI_COMPATIBLE 空壳**:apiKey 可配但没验证;预设 baseUrl 需要用户填。

## 方案(参考 Dify/AnythingLLM/OpenWebUI + 2026 RAG 基准)

调研结论(卡卡西式汲取):
- **AnythingLLM/Dify**:provider 抽象 + API key 存 DB 只写不回 + workspace 级模型选择——我们 Agent 系统已有雏形,补"默认不锁 ollama"即可。
- **2026 RAG 基准**(Firecrawl/Databricks/premai):递归 512-token 切片 + 10-20% overlap 是通用最优(69% 准确率);短文档(<200 token)不切;语义/LLM 切片贵 14-50 倍不划算;**切片质量 > embedding 模型**。
- **去重**:内容 hash(sha256)是 Dify/AnythingLLM 标配——同内容文档跳过 reindex,避免重复切片。

### Task 1:Embedding Provider 抽象(核心)

新建 `EmbeddingService`(或扩展 ollama.service),支持两种 embedding 来源,按 Agent 配置路由:

```ts
// src/ai/embedding.service.ts
// - OLLAMA: GET {OLLAMA_BASE_URL}/api/embed(现有逻辑迁入)
// - OPENAI_COMPATIBLE: POST {baseUrl}/embeddings(OpenAI 兼容协议,DeepSeek/硅基流动/OpenAI 通用)
// 选择逻辑:优先 Agent.providerConfig 里的 embedding 配置;
//          无则退回 env OLLAMA_BASE_URL(兼容现部署);
//          都没有则 RAG 功能 graceful 降级(检索跳过 embedding,返回空上下文,不 500)
```

- `knowledge.service.ts`:注入 EmbeddingService,替换 `ollamaService.embed`。
- `default-chat.engine.ts`:注入 EmbeddingService,替换 buildPromptMessages 里的 `ollamaService.embed`。
- Agent 增加 embedding 配置字段:`embeddingModel`/`embeddingBaseUrl`(可空,空则用 chat model 同源或默认)。
- RAG embedding 失败时:**记录 warn + 返回空上下文**,对话照常进行(不中断)。

### Task 2:文档去重 + 切片升级

**去重(核心)**:
- KnowledgeDocument 增加 `contentHash String?`。
- reindex 流程:提取文本 → `sha256(content)` → 查同 workspace 下同 hash 的 READY 文档:
  - **存在 → 直接 return**(跳过切片/embedding,状态 READY,不重复入库)。
  - **不存在 → 正常切片 + embedding + 入库**,记录 contentHash。
- 已有 chunks 更新逻辑:仅当 hash 变化才 deleteMany 重建;hash 相同直接 return。

**切片升级(2026 基准)**:
- `splitIntoChunks` 改为**递归切片**:优先按段落(`\n\n`)、行(`\n`)、句(`。.！？!?`)、字符回退,chunkSize 默认 **512 token 约 1500 字符**(中文 1 字≈1 token,保守 800-1000 字符)+ **15% overlap**(约 120-150 字符)。
- 短文档(<200 token,约 600 字符)**不切分**,整篇做单个 chunk。
- 保留现有 splitIntoChunks 导出签名兼容测试,内部改递归策略。

### Task 3:默认 Agent 去 ollama 化

- seed 默认 Agent:改为 `OPENAI_COMPATIBLE` + baseUrl 留空(用户首次进 Agents 页填 DeepSeek/OpenAI key),**不再默认 ollama**。
- docker-compose:`ollama` 服务保留但 api/web 的 `depends_on` 不再强制 ollama(ollama-init 模型拉取失败不应阻塞 api)。OLLAMA_* env 保留,作为"本地部署"选项。
- 对话无任何 provider 配置时:返回友好错误("请先在 Agents 页配置 LLM API Key"),不 500。

### Task 4:Agents 页 UI 补强

- 预设填 baseUrl 时校验格式;apiKey 输入提示"仅写入不回显"(已有)。
- Ollama 预设标注"需要本地运行 ollama";DeepSeek/OpenAI 预设标注"需要 API Key"。
- Agent 表单增加 embedding 配置折叠区(可选,默认跟随 chat provider)。

## Acceptance

- [ ] 无 ollama 环境(纯 API key):对话走 DeepSeek/OpenAI key 正常;文档上传→切片→RAG 检索正常(embedding 走 API)
- [ ] 有 ollama 环境:现有行为不回归
- [ ] 同一文档重复上传/reindex:第二次跳过切片(DB 里 chunk 不重复增长)
- [ ] embedding 失败:对话降级不中断,日志 warn
- [ ] 默认 Agent 不依赖 ollama;docker compose 起栈无 ollama 也可用(填 key 后)
- [ ] `npm run lint && typecheck && build` 全绿;API 单测通过(80+)
- [ ] 浏览器验收:Agents 页配 key → 对话 → 上传文档 → 问文档内容 → 回答引用文档

## Non-goals

- 不做向量数据库迁移(MongoDB 余弦够用,MVP 规模)。
- 不做多租户 API key 加密(apiKey 已只写不回,够用)。
- 不做 OPENCLAW/HERMES harness 真实调用(Phase 16)。
