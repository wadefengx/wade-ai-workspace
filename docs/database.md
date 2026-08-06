# 数据库设计(当前)

MongoDB(replica set,数据库名 `wade_workspace`),通过 **Prisma ORM** 访问(`apps/api/prisma/schema.prisma`)。Schema 变更流程:`prisma generate` → `prisma db push`(开发期)或迁移文件(生产)。

## 数据模型

### User / RefreshToken
- **User**:id(ObjectId)、name、email(唯一)、passwordHash、role(`USER`/`ADMIN` 全局角色)、avatarUrl。
- **RefreshToken**:id、userId、tokenHash、expiresAt,支持令牌轮换。

### Workspace / WorkspaceMember
- **Workspace**:id、name、icon、createdById、**defaultAgentId**(Phase 16:该工作区对话默认使用的 Agent)。
- **WorkspaceMember**:workspaceId + userId 唯一,role(`OWNER` > `ADMIN` > `MEMBER`)。
- 全局角色(User.role)与 Workspace 角色(Member.role)是**两套体系**:全局 ADMIN 可看所有 Workspace。

### Channel / Message
- **Channel**:workspaceId、name、createdById。
- **Message**:channelId、senderType(`USER`/`AGENT`)、status(`PENDING`/`STREAMING`/`COMPLETED`/`FAILED`)、content、feedback(`like`/`dislike`)、agentId(回复来源 Agent)。

### Agent(Phase 14/15)
- type:`OLLAMA` / `OPENAI_COMPATIBLE` / `ANTHROPIC` / `OPENCLAW` / `HERMES`。
- **providerConfigRef**(只写不回,API 返回 `hasApiKey` 摘要)、engineType、isDefault。
- 专家化字段:emoji、role、description、systemPrompt、**harness**(默认 OLLAMA)。
- **embeddingModel / embeddingBaseUrl**(Phase 15:Embedding 可独立配置)。

### KnowledgeDocument / KnowledgeChunk(RAG)
- **KnowledgeDocument**:workspaceId、filename、mimeType、storageKey、extractionStatus、**contentHash**(sha256,Phase 15 去重:同 workspace 同 hash 跳过 reindex)。
- **KnowledgeChunk**:documentId、content、**embedding Float[]**、chunkIndex、tokenCount。

### Memory(Phase 16:分层记忆 L0→L3)
- **level**:`L0_CONVERSATION` / `L1_ATOM` / `L2_SCENARIO` / `L3_PERSONA`。
- type:`PERSONAL`(私有)/ `TEAM` / `PROJECT`(共享)。
- **sourceMessageIds**(溯源链,可下钻到原始对话)、parentMemoryId(层级关联)、priority、confidence、enabled、**embedding**(L1 去重:余弦 > 0.92 跳过)。

## 关键设计

1. **API Key 只写不回**:Agent 的 providerConfigRef 存储,响应只返回 `hasApiKey` 布尔,杜绝密钥泄露。
2. **RAG 去重**:contentHash(文档)+ embedding 余弦(记忆),避免重复切片/重复抽取。
3. **渐进式披露**(TencentDB-Agent-Memory 思路):L3 画像引导召回 → L2 场景 → L1 原子事实按需下钻,全链路可追溯。

## Schema 变更流程

```bash
# 宿主(改 schema 后)
npm run prisma:generate --workspace=@wade/api
# 容器内(应用变更到 DB;node_modules 独立,两边都要 generate)
docker exec ai-workspace-api-1 sh -c "cd /app/apps/api && npx prisma generate && npx prisma db push --accept-data-loss"
```

> 注意:宿主机与容器的 prisma client 是**独立两份**,只 regenerate 一边会漏。Prisma 不支持 Optional 列表(`Float[]?` → P1012),用 `Float[]` + 空数组。
