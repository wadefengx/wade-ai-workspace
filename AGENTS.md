# AGENTS.md — Zone AI Runtime Entry

## Mission

This repository runs as an AI Native, local-first workspace: specs define the contract, agents execute bounded lanes, and durable context is written back into memory, skills, knowledge, architecture, and harness artifacts so later sessions start smarter instead of colder.

## Context loading order

1. This `AGENTS.md`.
2. `.ai/organization/` for team model, routing, communication, and role contracts.
3. `.ai/runtime/` for context, prompt, model, tool, and coding policy.
4. Relevant `.ai/specs/` files for active scope; legacy `specs/` stays readable during migration.
5. Relevant `.ai/skills/` files for proven execution patterns; legacy `skills/` stays readable during migration.
6. `.ai/memory/` for durable facts, decisions, conventions, and known issues.
7. `.ai/architecture/`, `.ai/knowledge/`, and `.ai/harness/` when the task needs deeper reference or validation assets.

## AI lifecycle

`Requirement -> Spec -> Plan -> Impl -> Review -> Test -> Eval -> Memory -> Skill -> Knowledge`

| Stage | Minimum outcome |
|---|---|
| Requirement | Clear goal, scope, and non-goals |
| Spec | Paths, contracts, constraints, tasks, and acceptance |
| Plan | Smallest safe execution sequence |
| Impl | Surgical change in the correct shared seam |
| Review | Scope, contract, and risk check |
| Test | Smallest existing proof that behavior holds |
| Eval | Regression, benchmark, or scenario evidence when warranted |
| Memory | Durable facts, decisions, lessons, conventions, known issues |
| Skill | Reusable playbook promoted only after repeat value |
| Knowledge | Curated reference for business, product, engineering, and frameworks |

## Global engineering rules

1. Spec is the source of truth when code, docs, and chat disagree.
2. Run existing lint, typecheck, and test gates for the smallest scope that proves the task.
3. Keep user-facing errors and validation copy in Chinese unless a spec says otherwise.
4. Prefer copy-safe migrations over move/delete when parallel lanes may still read old paths.
5. Reuse helpers, contracts, and patterns before writing new code; fix root causes, not one caller.
6. Keep the workspace SPA conventions intact: shared layout, stable navigation, and documented response shapes.
7. Use `npmmirror` for npm and `gitclone` for GitHub taps; fall back to `quay.io` when Docker Hub is unavailable.
8. Do not touch unrelated app code for document-only or structure-only work.
9. Update direct docs when behavior, process, or durable context changes.

## Directory index

| Path | Purpose |
|---|---|
| `.ai/organization/` | Constitution, team, routing, communication, and role contracts |
| `.ai/runtime/` | Context loading, model routing, prompt, tool, coding, and priority policy |
| `.ai/workflows/` | Feature, bugfix, refactor, release, architecture, and research flows |
| `.ai/specs/` | Canonical spec template plus completed, active, and archived buckets |
| `.ai/skills/` | Common and domain-specific reusable skills |
| `.ai/memory/` | Durable project facts, decisions, conventions, lessons, and issues |
| `.ai/knowledge/` | Business, product, engineering, framework, and reference knowledge |
| `.ai/architecture/` | System overviews, module maps, API notes, and ADRs |
| `.ai/harness/` | Evals, fixtures, benchmark, regression, prompts, and scorecards |
| `.ai/templates/` | Template references that point to canonical sources |
| `.ai/changelog/` | Archive for longer historical notes |
| `specs/` | Legacy readable path kept for migration compatibility |
| `skills/` | Legacy readable path kept for migration compatibility |

## References

- `.ai/organization/constitution.md`
- `.ai/runtime/context-loading.md`
- `.ai/workflows/feature.md`
- `.ai/memory/project.md`
- `.ai/architecture/overview.md`
- `.ai/harness/README.md`
- `.ai/specs/TEMPLATE.md`
- `.ai/skills/common/ponytail.md`

## Change Log

- 2026-08-01 Phase 11 Lane B: refactored chat shell scrolling isolation, removed the chat right panel, switched Chats to one-click `对话 N` creation, added AI hover actions/thinking/loading states with `@ant-design/x`, added Memory isolated scrolling, and inserted the Dashboard nav entry.
- 2026-08-01 Phase 11 Lane A: added Message.feedback persistence/toggle API, organization/feedback stats endpoints with resilient `.ai`+git fallbacks, and backend unit coverage for feedback/stats behavior.
- 2026-08-01 Phase 10 Lane A: added backend Workspace icon support in Prisma/schema, seed backfill/default demo data, workspace create/update DTO handling, and API tests for icon persistence/validation.
- 2026-08-01 Phase 11:聊天体验重构 + 双 Dashboard。滚动隔离(100vh shell + 内容区独立滚动,chat/memory)、移除右侧 AI Context 面板、ChatGPT 式一键新建对话、AI 消息 thinking/操作条(like/dislike/regenerate/copy + feedback API)、Sender loading + 状态条(antdx 组件;修复 suffix 覆盖 submit 按钮 bug)、AI Organization Dashboard + Feedback Dashboard(stats API:assets/lanes/pipeline/improvements/feedback 聚合)。
- 2026-08-01 Phase 10 自我进化(全角色):PM/Architect 落地运行机制(planner/lane-states/confidence/dependency-graph/backlog/review-workflow/memory-to-skill + ADR-006);UX/UI/FE 响应式/a11y/空状态统一/微交互/视觉一致;BE/QA e2e 迁入 `.ai/harness/regression/`(phase6 30 + phase9 19 + phase10 13 全绿)+ 3 高价值单测;修复折叠态 icon 参差(统一 40×40)。
- 2026-08-01 Phase 10:UX/UI 重构 + AIOS 增强(zustand/动画/dayjs/workspace icon/mermaid/登录页 Apple 化 + registry/pipeline/topology)。
- 2026-08-01 Phase 9 Lane C: added AIOS `.ai/` organization/runtime/workflow/memory/knowledge/architecture/harness structure, copied specs and skills into `.ai`, and rewrote `AGENTS.md` as the runtime entrypoint.
- 2026-08-01 Phase 9 Lane B: added persisted JWT session restore + single-flight refresh retry, sidebar collapse persistence, Chats search/time grouping, and a header theme toggle in `apps/web/src/{stores/auth.ts,lib/api.ts,components/{auth-page.tsx,workspace-context.tsx,workspace-navigation.tsx,workspace-shell.module.css}}`.
- 2026-08-01 Phase 8 Lane C: added Settings / Specs / Skills pages, expanded Agents presets and CRUD UI, and enabled `@All` mention highlighting.
- 2026-08-01 Phase 8 Lane B: added persistent theme mode, Zone AI branding, dynamic workspace titles, and Settings / Specs / Skills navigation.
- 2026-08-01 Phase 8 Lane A: extended users/workspace/knowledge/agents/auth APIs, added docs browser support, and moved Swagger to `/api/swagger`.
- 2026-08-01 Engineering baseline: formalized `specs/` workflow, added shared skills, documented test accounts, and initialized git.

Older history should move to `.ai/changelog/` as dedicated archive entries are added.
