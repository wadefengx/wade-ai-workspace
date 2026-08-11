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
| Planner | Context pack, acceptance | Requirement -> Epic -> Story -> Task -> Lane decomposition | `runtime/planner.md`, `specs/TEMPLATE.md` |
| Backlog Router | Planner output, deps, owners | Queues lane, DAG, initial State | `runtime/backlog.md`, `runtime/dependency-graph.md`, `runtime/lane-states.md` |
| Lane Executor | Ready lane, runtime policy | Concrete edits, commands, artifacts | `runtime/coding-policy.md`, `runtime/tool-policy.md`, `runtime/prompt-policy.md` |
| Review Workflow | Lane output, spec, workflow | Self-test conclusion, repair action, memory Input | `workflows/review.md`, `runtime/confidence.md` |
| Harness | Reviewed output, assertions | Eval result, golden case, score | `harness/README.md`, `harness/feature-login/evals.yaml` |
| Confidence Gate | Review result, harness evidence | merge / escalate / rework decision | `runtime/confidence.md`, `runtime/lane-states.md` |
| Memory Writer | Accepted result, durable facts | Memory, lesson, decision updates | `memory/README.md`, `runtime/memory-to-skill.md` |
| Skill Promotion | Stable memory pattern, architect decision | Skill candidate or promoted skill | `runtime/memory-to-skill.md`, `registry/skills.yaml` |
| Done | Reviewed change, confidence result, memory refs | Final handoff with traceable artifacts | `AGENTS.md`, `registry/README.md` |

## Checkpoints

| Checkpoint | When | Pass condition | Fallback |
|---|---|---|---|
| Planner Ready | At Planner completion | Decomposed to lanes with owner/deps/acceptance complete | Fill in Epic/Story/Task decomposition |
| Review Confidence | After Review | `review_confidence >= 0.70` or escalated to Architect | Continue fixing or escalate review |
| Release Confidence | After Harness | `release_confidence >= 0.70` and dependencies complete | Remain `Done`/`Blocked`; do not merge |

## Example walkthroughs

### Feature

| Step | Walkthrough |
|---|---|
| Request | Add a new workspace capability with a phase spec. |
| Classify | `new feature` -> PM + Architect route. |
| Select | Load `workflows/feature.md` and pipeline defaults from `registry/workflows.yaml`. |
| Resolve | Reuse `common-sdd-workflow` for lane split and `common-ponytail` for smallest-diff execution. |
| Load | Pull `AGENTS.md`, active spec, touched memory, and targeted architecture docs. |
| Plan | First decompose Epic/Story/Task/Lane and document deps, owner, and initial confidence. |
| Queue | Put lanes in the backlog and start Ready lanes in DAG topological order. |
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
| Plan | If a bug affects multiple surfaces, first decompose Story/Task/Lane instead of jumping directly to a single lane. |
| Execute | Reproduce or trace the failure, patch the root cause, and keep the diff scoped. |
| Harness | Capture a regression or eval artifact if the failure can recur. |
| Write back | Update bug memory and lessons so the next lane loads the fix context earlier. |
