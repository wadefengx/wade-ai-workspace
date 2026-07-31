---
name: sdd-workflow
description: 团队通用 SDD 工作流——从需求、spec、开发到 QA 与沉淀的操作化步骤。
owner: pm
version: "1.0"
tags: [workflow, delivery, planning, all-roles]
inputs: [task, spec]
outputs: [execution-plan, acceptance]
depends: []
confidence: stable
---

# SDD Workflow

## 触发条件

- 新 phase、新模块、新页面、新 API 或跨前后端联动需求。
- 需要多人/多 agent 并行协作时。
- 需求边界、权限、契约可能影响多个模块时。

## 步骤

1. **需求**:用户提出目标,PM 明确目标、范围、边界、不做项。
2. **系分**:拆清角色、权限、页面、接口、数据与依赖。
3. **架构**:PM 联合前后端确认路由、契约、数据模型、权限方案。
4. **拆任务**:PM 拆成后端 lane、前端 lane、QA 任务,写进 spec。
5. **spec**:产出 `specs/SPEC-<phase>.md`,评审通过后再开发。
6. **开发**:前后端按 spec 实施,优先复用现有模式与组件。
7. **QA**:按验收清单跑 lint/typecheck/test 与关键 e2e,记录 PASS/FAIL。
8. **沉淀**:通用经验写入 `skills/`,关键结论写入长期记忆/上下文。

## 产出物路径

- `specs/SPEC-<phase>.md`:每期正式 spec。
- `specs/TEMPLATE.md`:spec 模板。
- `skills/*.md`:团队通用 skill 沉淀。
- `docs/`:长期架构、数据库、API 说明,不承载 phase spec。

## 验收命令

```bash
npm run lint --workspace=@wade/api
npm run typecheck --workspace=@wade/api
npm test --workspace=@wade/api
npm run lint --workspace=@wade/web
npm run typecheck --workspace=@wade/web
npm test --workspace=@wade/web
```

- 若本期有专用脚本或 e2e,在对应 spec 的验收清单追加。

## 常见坑

- spec 与实现冲突时,以 spec 为准,并同步更新 spec 以反映最终决策。
- 只改代码不补 spec/skill,会让后续 agent 丢上下文。
- QA 不能只看 happy path,要覆盖权限隔离、空态、错误态、回归链路。
- phase spec 放到 `specs/`,不要混回 `docs/`。
