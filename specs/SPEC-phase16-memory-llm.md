---
name: SPEC-phase16-memory-llm
status: approved
version: 1.0
created: 2026-08-05
owner: wadefengx
---

# Phase 16:记忆分层(L0-L3)+ workspace 级 LLM + RAG 引用 + provider 一键配置

## Goal

四条主线(用户确认全做)+ 腾讯 TencentDB-Agent-Memory 创意落地:

1. **Workspace 级 LLM 切换**(AnythingLLM):每个 workspace 可选自己的默认 Agent/模型。
2. **Provider 一键配置**(Dify):DeepSeek/OpenAI/本地预设补全 baseUrl,填 key 即用。
3. **RAG 内联引用**(Open WebUI):AI 回答标注引用的知识 chunk 来源。
4. **记忆分层 L0-L3**(TencentDB-Agent-Memory 核心创意):对话→原子事实→场景→用户画像,渐进式披露,取代扁平记忆表。
5. **符号记忆(可选,Phase 17)**:长对话工具日志→外部文件+Mermaid 摘要。本期先做数据模型与抽取管线,L2/L3 可视化面板放下期。

## 现状(已勘察)

- Memory 模型:扁平表(workspaceId/userId/type/content/confidence/enabled)——**无分层**。
- Agent 已有 providerConfig(baseUrl/apiKey/model)+ 6 预设;workspace 无 defaultAgentId。
- RAG:KnowledgeChunk + 余弦检索已接入对话,但回答**不标注引用来源**。
- EmbeddingService(Phase 15):API + 本地回退已完成。

## 任务

### Task 1:Memory 分层 L0-L3(核心创意)

**Schema 重构 Memory 模型**:

```prisma
model Memory {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  workspaceId String   @db.ObjectId
  userId      String?  @db.ObjectId
  level       MemoryLevel  // L0_CONVERSATION | L1_ATOM | L2_SCENARIO | L3_PERSONA
  type        MemoryType   // FACT | PREFERENCE | DECISION | LESSON | ...
  content     String       // L0:原始对话;L1:原子事实;L2:场景描述;L3:画像条目
  sourceMessageIds String[]?  // 溯源链(下钻)
  parentMemoryId  String?     // L2 的父是 L3,L1 的父是 L2(层级关联)
  confidence  Float?
  priority    Int?      @default(0)
  enabled     Boolean   @default(true)
  createdBy   String    @db.ObjectId
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([workspaceId, level])
  @@index([workspaceId, userId, level])
}
```

**抽取管线(memory.service.ts)**:
- `extractFromConversation(channelId)`:取频道最近 N 条消息 → 单次 LLM 调用(JSON-mode,参考 TencentDB 的 scene-segmentation prompt)→ 输出场景分段 + L1 原子事实(含 type/priority/sourceMessageIds)。
- **L1 去重**:同 workspace 下 content 语义近似(embedding 余弦 > 0.92 或同 sourceMessageIds)→ 跳过(batchDedup 思路)。
- **L2 场景**:LLM 把同场景的 L1 聚合为场景块(含摘要 + 关联 L1 id 列表)。
- **L3 画像**:LLM 从 L2 提炼用户偏好/习惯(如"用户偏好 Markdown 文档"、"用户反感 UI 占位"),存为 persona 条目。
- **触发**:频道消息数达到阈值(如 20 条)或手动按钮触发;失败降级(不阻塞对话)。
- **检索**:对话时注入——L3 画像(全量,小)+ L2 场景(按相关度 topK)+ L1 原子(按需下钻),渐进式披露。

**兼容**:旧 Memory 数据迁移为 L1_ATOM(level 默认),现有 Memory 页展示按 level 分组。

### Task 2:Workspace 级 LLM 切换(AnythingLLM)

- Workspace 加 `defaultAgentId String?`(关联 Agent)。
- Workspace 创建/设置表单:选择默认 Agent(下拉,列出该 workspace 的 agents)。
- chat.service streamAgentReply:优先 workspace.defaultAgentId → 无则 ensureDefaultAgent(现有逻辑兜底)。
- 前端:workspace 选择器旁显示当前默认 Agent(emoji + 名),可快速切换。

### Task 3:RAG 内联引用(Open WebUI)

- default-chat.engine 检索 chunks 后,把 chunk 来源(文件名 + chunkIndex)作为**引用标记**注入 prompt,要求 LLM 在引用处输出 `[^n]` 上标。
- 前端消息渲染:识别 `[^n]` → 渲染为可点击引用角标 → 点击弹出 Popover 显示对应 chunk 原文 + 来源文档。
- 回答尾部附"参考文档"列表(文档名 + 点击跳 Knowledge 页)。

### Task 4:Provider 一键配置(Dify)

- 预设补全:`DeepSeek` 预设 baseUrl=`https://api.deepseek.com/v1`、模型=`deepseek-chat`;`OpenAI` baseUrl=`https://api.openai.com/v1`;`Ollama` 标注本地。
- Agents 页:选预设即自动填 baseUrl/model,用户只填 apiKey;填完可"测试连接"(调 chat/completions 空请求验证,返回 ok/错误信息)。
- 后端:POST /agents/:id/test 端点,调 provider 验证配置。

## Acceptance

- [ ] 对话后 Memory 出现 L1 原子事实;同内容重复对话不重复抽取(L1 去重)
- [ ] L2/L3 可由 L1 聚合生成;Memory 页按 L0/L1/L2/L3 分组展示
- [ ] Workspace 可设默认 Agent;对话走该 Agent(而非全局默认)
- [ ] AI 回答含 `[^n]` 引用角标,点击可见 chunk 原文
- [ ] DeepSeek 预设一键填 baseUrl/model,"测试连接"可用
- [ ] `npm run lint && typecheck && build` 全绿;API 单测通过
- [ ] 浏览器验收全链路

## Non-goals

- 符号记忆(Mermaid canvas)与 Memory 可视化面板(Phase 17)。
- Code-Graph/LLM-Wiki 资产(Phase 18)。
- 不做 memory 跨 workspace 共享。
