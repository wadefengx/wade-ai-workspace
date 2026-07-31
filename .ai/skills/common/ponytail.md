---
name: ponytail
description: 团队 common skill——懒惰工程哲学(最短可行实现、YAGNI、根因修复)。
owner: frontend
version: "1.0"
tags: [engineering, philosophy, all-roles]
inputs: [task, code]
outputs: [minimal-diff, decision]
depends: []
confidence: stable
---

# Ponytail

## The ladder

按这个顺序判断,停在第一个足够的选项:

1. 不需要就不做。
2. 复用现有 helper、模块、模式。
3. 用标准库。
4. 用平台原生能力。
5. 用已安装依赖。
6. 能一行就一行。
7. 最后才写最小实现。

## Bug fix = 根因修复

- 先追调用链,修共享根因,不要只补报错路径。
- 优先改公共入口、共享校验、共用 helper,避免同类问题在兄弟路径复发。

## 规则

- 不加未被请求的抽象。
- 删除优于新增,复用优于重写。
- 最短 diff 胜出,前提是正确覆盖真实问题。
- 有意保留的取舍用 `ponytail:` 注释标记,顺手写清已知上限和后续升级方向。

## 不做简化

- 信任边界输入校验。
- 数据安全、权限、安全相关处理。
- 用户或 spec 显式要求的能力、约束、验收项。

## 输出风格

- 先给结论,再给必要依据。
- 控制复杂度:少文件、少抽象、少样板。
- 只解释关键取舍,不做流程复述。
