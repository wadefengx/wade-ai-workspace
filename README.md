# Wade AI Workspace

面向团队的本地 AI Native Workspace。当前仓库实现了 Phase 0 工程基线：Next.js 工作台壳、NestJS 健康 API、MongoDB replica set、Ollama 和 Prisma 数据模型。

## 启动

```bash
cp .env.example .env
docker compose up --build
```

首次启动会初始化 MongoDB replica set、推送 Prisma schema、写入演示工作区并下载 Ollama 聊天与 embedding 模型。模型下载时间取决于网络。

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health

## 测试账号

| 账号 | 密码 | 角色 | 说明 |
|------|------|------|------|
| admin@wade.local | admin | 全局管理员 | 最高权限,可查看所有 Workspace 与数据 |
| alice@wade.local | password123 | OWNER(Team Alpha) | 主演示账号,有频道/知识库/记忆数据 |
| bob@wade.local | password123 | MEMBER(Team Alpha) | 普通成员,权限隔离演示 |

- 注册入口可创建新账号。
- Workspace 内角色层级:OWNER > ADMIN > MEMBER。
- 全局管理员系统角色为 `ADMIN`。

## 常用命令

```bash
# 停止并保留数据
docker compose down

# 查看服务日志
docker compose logs -f api web

# 重置所有本地数据库、上传文件和模型缓存（不可恢复）
docker compose down -v

# 在 API 容器内执行 Prisma 操作
docker compose exec api npm run prisma:push
docker compose exec api npm run prisma:seed

# 切换 Ollama 模型：修改 .env 后重新拉取
docker compose run --rm ollama-init
```

所有运行时数据均位于 Docker 命名 volume；上传文件共享在 `uploads` volume，不依赖宿主机目录。

## 质量检查

```bash
npm install
npm run lint
npm run typecheck
npm test
```

## 数据模型与回滚

Prisma 使用 MongoDB provider。开发中执行 `npm run db:push` 将 schema 应用到本地数据库；MongoDB 不提供 Prisma migration 文件。schema 变更应先兼容读取旧字段、完成数据回填后再删除旧字段。开发环境若需完全回滚，可使用 `docker compose down -v` 后重新启动。

详细设计见 `docs/architecture.md`、`docs/database.md` 和 `docs/api-contracts.md`。
