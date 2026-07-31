# Runtime Pipeline

`User Task -> Task Classifier -> Workflow Selector -> Skill Resolver -> Context Loader -> Planner -> Executor -> Reviewer -> Harness -> Memory Writer -> Done`

## Standard pipeline

| Stage | Input | Output | Reference |
|---|---|---|---|
| User Task | User ask, scope, constraints | Normalized task statement | `AGENTS.md`, `organization/constitution.md` |
| Task Classifier | Normalized task statement | Task type, owner set, escalation need | `organization/routing.md`, `organization/topology.md` |
| Workflow Selector | Task type, acceptance target | Workflow doc and lane shape | `registry/workflows.yaml`, `workflows/feature.md`, `workflows/bugfix.md` |
| Skill Resolver | Workflow doc, task shape | Reusable skill shortlist | `registry/skills.yaml`, `skills/common/ponytail.md`, `skills/common/sdd-workflow.md` |
| Context Loader | Workflow, skills, touched paths | Ordered context pack | `runtime/context-loading.md`, `runtime/context-priority.md`, `registry/README.md` |
| Planner | Context pack, acceptance | Smallest safe execution plan | `specs/TEMPLATE.md`, `skills/common/sdd-workflow.md` |
| Executor | Plan, runtime policy | Concrete edits, commands, artifacts | `runtime/coding-policy.md`, `runtime/tool-policy.md`, `runtime/prompt-policy.md` |
| Reviewer | Diff, spec, workflow | Scope/risk decision and follow-up fixes | `workflows/feature.md`, `workflows/bugfix.md`, `workflows/refactor.md` |
| Harness | Reviewed output, assertions | Eval result, golden case, score | `harness/README.md`, `harness/feature-login/evals.yaml` |
| Memory Writer | Accepted result, durable facts | Memory, skill, knowledge updates | `memory/README.md`, `skills/TEMPLATE.md` |
| Done | Reviewed change, harness result, memory refs | Final handoff with traceable artifacts | `AGENTS.md`, `registry/README.md` |

## Example walkthroughs

### Feature

| Step | Walkthrough |
|---|---|
| Request | Add a new workspace capability with a phase spec. |
| Classify | `new feature` -> PM + Architect route. |
| Select | Load `workflows/feature.md` and pipeline defaults from `registry/workflows.yaml`. |
| Resolve | Reuse `common-sdd-workflow` for lane split and `common-ponytail` for smallest-diff execution. |
| Load | Pull `AGENTS.md`, active spec, touched memory, and targeted architecture docs. |
| Execute | Implement the smallest end-to-end change, then review against spec acceptance. |
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
| Execute | Reproduce or trace the failure, patch the root cause, and keep the diff scoped. |
| Harness | Capture a regression or eval artifact if the failure can recur. |
| Write back | Update bug memory and lessons so the next lane loads the fix context earlier. |
