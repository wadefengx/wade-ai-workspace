# Runtime Pipeline

`User Task -> Task Classifier -> Workflow Selector -> Skill Resolver -> Context Loader -> Planner -> Backlog Router -> Lane Executor -> Review Workflow -> Harness -> Confidence Gate -> Memory Writer -> Skill Promotion -> Done`

## Standard pipeline

| Stage | Input | Output | Reference |
|---|---|---|---|
| User Task | User ask, scope, constraints | Normalized task statement | `AGENTS.md`, `organization/constitution.md` |
| Task Classifier | Normalized task statement | Task type, owner set, escalation need | `organization/routing.md`, `organization/topology.md` |
| Workflow Selector | Task type, acceptance target | Workflow doc and lane shape | `registry/workflows.yaml`, `workflows/feature.md`, `workflows/bugfix.md` |
| Skill Resolver | Workflow doc, task shape | Reusable skill shortlist | `registry/skills.yaml`, `skills/common/ponytail.md`, `skills/common/sdd-workflow.md` |
| Context Loader | Workflow, skills, touched paths | Ordered context pack | `runtime/context-loading.md`, `runtime/context-priority.md`, `registry/README.md` |
| Planner | Context pack, acceptance | Requirement -> Epic -> Story -> Task -> Lane 拆解 | `runtime/planner.md`, `specs/TEMPLATE.md` |
| Backlog Router | Planner output, deps, owners | 队列化 lane、DAG、初始状态 | `runtime/backlog.md`, `runtime/dependency-graph.md`, `runtime/lane-states.md` |
| Lane Executor | Ready lane, runtime policy | Concrete edits, commands, artifacts | `runtime/coding-policy.md`, `runtime/tool-policy.md`, `runtime/prompt-policy.md` |
| Review Workflow | Lane output, spec, workflow | 自检结论、修复动作、memory 输入 | `workflows/review.md`, `runtime/confidence.md` |
| Harness | Reviewed output, assertions | Eval result, golden case, score | `harness/README.md`, `harness/feature-login/evals.yaml` |
| Confidence Gate | Review result, harness evidence | merge / escalate / rework 决策 | `runtime/confidence.md`, `runtime/lane-states.md` |
| Memory Writer | Accepted result, durable facts | Memory, lesson, decision updates | `memory/README.md`, `runtime/memory-to-skill.md` |
| Skill Promotion | Stable memory pattern, architect decision | Skill candidate or promoted skill | `runtime/memory-to-skill.md`, `registry/skills.yaml` |
| Done | Reviewed change, confidence result, memory refs | Final handoff with traceable artifacts | `AGENTS.md`, `registry/README.md` |

## Checkpoints

| Checkpoint | When | Pass condition | Fallback |
|---|---|---|---|
| Planner Ready | Planner 结束时 | 已拆到 lane,owner/deps/acceptance 齐全 | 回补 Epic/Story/Task 拆解 |
| Review Confidence | Review 后 | `review_confidence >= 0.70` 或已升级 Architect | 继续修复或升级 review |
| Release Confidence | Harness 后 | `release_confidence >= 0.70` 且依赖完成 | 保持 `Done`/`Blocked`,不 merge |

## Example walkthroughs

### Feature

| Step | Walkthrough |
|---|---|
| Request | Add a new workspace capability with a phase spec. |
| Classify | `new feature` -> PM + Architect route. |
| Select | Load `workflows/feature.md` and pipeline defaults from `registry/workflows.yaml`. |
| Resolve | Reuse `common-sdd-workflow` for lane split and `common-ponytail` for smallest-diff execution. |
| Load | Pull `AGENTS.md`, active spec, touched memory, and targeted architecture docs. |
| Plan | 先拆 Epic/Story/Task/Lane,写清 deps、owner、initial confidence。 |
| Queue | 将 lanes 放入 backlog,按 DAG 拓扑拉起 Ready lanes。 |
| Execute | Implement the smallest end-to-end change, then enter review workflow against spec acceptance. |
| Harness | Add or update a workflow harness directory with a golden case and eval file. |
| Write back | Store durable decisions in memory and extract a new skill only if the pattern repeats. |

### Bugfix

| Step | Walkthrough |
|---|---|
| Request | Reported regression with repro steps and affected path. |
| Classify | `bugfix` -> PM + affected lane + QA route. |
| Select | Load `workflows/bugfix.md` and keep the execution path narrow. |
| Resolve | Reuse `common-ponytail` to trace sibling callers and fix the shared seam once. |
| Load | Pull the active spec if behavior is contract-bound, plus known issues and relevant harness assets. |
| Plan | 若 bug 影响多个面,先拆 Story/Task/Lane,避免直接跳到单 lane。 |
| Execute | Reproduce or trace the failure, patch the root cause, and keep the diff scoped. |
| Harness | Capture a regression or eval artifact if the failure can recur. |
| Write back | Update bug memory and lessons so the next lane loads the fix context earlier. |
