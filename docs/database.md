# 数据库设计（Phase 0）

使用 PostgreSQL 保存控制面数据。工作区内源码、缓存和构建产物属于容器卷，不进入业务表。

## 数据模型

### users

- `id`：主键（UUID）
- `email`：登录标识，唯一
- `password_hash`：仅保存密码哈希
- `created_at`、`updated_at`

用户与工作区是一对多关系。认证实现可在后续替换为 OAuth，而不改变工作区归属关系。

### workspaces

- `id`：主键（UUID）
- `owner_id`：外键，指向 `users.id`
- `name`：用户可见名称
- `status`：`creating`、`running`、`stopped`、`failed`、`deleting`
- `container_id`：Docker 容器标识，可为空
- `created_at`、`updated_at`、`last_active_at`

状态存于数据库而非仅依赖 Docker 查询，使失败、删除和审计均可追踪；`container_id` 可在容器重建后更新。

## 约束与索引

- `users.email`：唯一索引，防止重复账号。
- `workspaces.owner_id`：普通索引，覆盖“列出当前用户工作区”。
- `workspaces(owner_id, updated_at DESC)`：复合索引，覆盖按最近更新排序的列表。
- `workspaces.status`：仅在存在后台按状态批量回收需求时建立索引；Phase 0 可延后添加。
- 外键使用 `ON DELETE CASCADE`，删除用户时删除其控制面工作区记录；容器和卷清理由应用层显式执行。

## 迁移策略

1. 使用版本化、顺序执行的迁移文件创建和变更 schema。
2. 每次迁移必须包含可安全重复部署的前置检查，并在部署流水线中先执行迁移再发布 API。
3. 破坏性变更采用“新增字段/双写/回填/切换读取/删除旧字段”多版本步骤，避免应用与数据库版本错配。
4. 生产迁移前备份；大表索引使用在线方式创建，并记录迁移执行结果。

Phase 0 不存储令牌明文、容器日志或工作区文件内容。
