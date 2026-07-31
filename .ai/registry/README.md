# Registry

## Rule

- AI **先查 Registry,不扫目录**。
- Registry 负责把 `workflow / skill / role / model / tool / memory` 映射到稳定路径。
- `path` 默认相对 `.ai/` 根目录书写,例如 `skills/common/ponytail.md`。

## YAML convention

| Key | Required | Meaning |
|---|---|---|
| `path` | Yes | `.ai/` 相对路径 |
| `description` | Optional | 简短用途 |
| `tags` | Optional | 检索标签 |
| `owner` | Optional | 默认责任角色 |
| `depends` | Optional | 依赖的 registry key 列表 |
| `reference` | Optional | 上游规则或运行时文档 |

## Files

| File | Purpose |
|---|---|
| `skills.yaml` | Skill 索引与分类占位 |
| `workflows.yaml` | Workflow 与 pipeline 入口 |
| `models.yaml` | 默认模型链与回退顺序 |
| `tools.yaml` | 项目工具索引 |
| `roles.yaml` | 角色文档索引 |
| `prompts.yaml` | Prompt 资产占位骨架 |
| `memory.yaml` | Memory 热点索引占位骨架 |
