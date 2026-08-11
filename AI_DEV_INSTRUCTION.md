# AI-Native development system Instruction (universal template)

> This document is a general extracted version of the **AI-Native development system** precipitated by the Wade AI project. When any new project is started, you can quickly set up AI configuration, development team and iteration process by directly reading this file. **Not dependent on specific project background**.
> Supported use: ponytail philosophy (minimum viable implementation / YAGNI / root cause repair).

---

## 1. Core idea

- **AI-first, people set goals**: People are Supervisors, AI is productivity. Requirements are proposed by people, driven by spec, executed by agents, and accepted by people.
- **Spec is the only source of truth**: There must be spec before implementation; when code/documentation/dialogue conflicts with spec, spec shall prevail and spec will be written back.
- **All precipitated reflow**: Each completed task must be reflowed `memory` (experience/decision/lesson) → `skill` (reusable ability) → `knowledge` (reference), so that the AI ​​will become stronger with more use, and the next task will not be repeated.

## 2. New project startup steps (15 minutes)

1. `git init -b main` + write `.gitignore`(node_modules/.next/dist/.env/upload directory).
2. Copy this file as `AGENTS.md` (or keep this file and reference it in AGENTS.md), and change the Mission and directory index according to the actual project.
3. Create the `.ai/` directory skeleton (see §4; can be copied directly from this repository).
4. Configure dependent mirror sources (see §7, China Network Environment).
5. Write the first `specs/SPEC-001.md` (see §4 for template) → develop → harness acceptance → commit.

## 3. Each period’s requirements iteration process (SDD)

```text
Requirements raised → PM functional division (scope/boundary/excluding items)
→ Architecture design (PM+front-end+back-end: routing/contract/data model/permissions)
→ Task splitting (PM: Split lanes by field to ensure no file conflicts)
→ Parallel development (each lane is independent, comply with ponytail)
→ QA acceptance (single test + harness regression + browser actual test)
→ Reflow (lessons/decisions write memory, common practice precipitates skill)
→ git commit
```

**Lane segmentation principle**: Split by domain (backend/frontend foundation/frontend page/documentation/QA), each lane has an exclusive set of files; cross-lane shared files (such as navigation/layout) specify a single owner; the contract is determined first (the API signature is written clearly in the spec), and there is no joint debugging in parallel.

## 4. AIOS organization layer (.ai/ directory)

```text
.ai/
├── organization/ # How AI collaborates: constitution (five major object models)/team/roles/*/routing/topology
├── runtime/ # How AI runs: pipeline (standard execution pipeline)/model-routing/tool-policy/coding-policy
│ # + planner(Requirements→Epic→Story→Task→Lane)/lane-states(state machine)/confidence(confidence)
├── workflows/ # Reusable processes: feature/bugfix/refactor/release/architecture/research/review
├── registry/ # Runtime index (key!): skills.yaml/workflows.yaml/models.yaml/tools.yaml/roles.yaml
│ # —— AI checks the registry first, without scanning the directory
├── specs/ # TEMPLATE.md + active/ + completed/ + archived/(frontmatter with status)
├── skills/ # Reusable skills (common/frontend/backend/...), frontmatter with metadata
├── memory/ # Long-term memory (architecture/engineering/product/bug/lessons/glossary classification)
├── knowledge/ # Passive reference (business/product/engineering/framework/references)
├── architecture/     # overview/tech-stack/modules/api-contract + adr/ADR-xxx.md
├── harness/ # AI quality system:regression script/golden case/evals/scorecards(AI CI)
└── changelog/ # Historical archive
```

**Five major object models** (written into constitution):
`Organization (collaboration) → Specification (what to build) → Workflow (how to build it) → Knowledge (what the team knows) → Runtime (how to execute)`; `Memory / Skill / Harness` are three systems throughout the life cycle.

**Spec Template Essentials**: Background / Goal / Scope / Non-goals / UX / API Contract / Database / Acceptance Criteria / Risks / Tasks / QA Checklist; frontmatter with `status: draft|approved|implementing|testing|done`.

## 5. Team and Lane operating mechanism

- **Roles**: PM / Architect / UX / Front-end / Back-end / QA, each role has its own `.ai/organization/roles/*.md` (Mission/Responsibility/Input/Output/Boundary/DoD).
- **Execution mode**: The orchestrator (Hermes class agent) is responsible for lane splitting, dispatching, monitoring, and acceptance; multiple lanes are parallel, and QA finally accepts them uniformly.
- **Lane state machine**: `Draft → Ready → Running → Review → QA → Done → Merged`, stuck (no progress in multiple rounds) → `Blocked`.
- **Confidence mechanism**: Each lane has confidence (implementation completeness/test coverage/contract compliance score); `<0.7` automatic Architect Review, `<0.5` external review.
- **Review is a process, not a chat**: Lane → Code → Self Review → Harness score → Memory update → Merge decision.
- **Memory → Skill promotion**: Lesson accumulation → Skill Candidate → Architect Review → Promote (organizational learning).

## 6. Project quality access control (must be all green in each phase)

1. `lint` + `typecheck` + `test` (unit) + `build` (production build).
2. **Harness regression**: Key processes have executable acceptance scripts (such as `verify-phaseN.sh`), PASS/FAIL count, and exit codes; each important workflow has a harness directory.
3. **Browser test list**: Core user paths are verified one by one (login/refresh recovery/navigation/form/streaming/feedback/dark mode).
4. The test account is fixed in the README; error messages are in Chinese (unless the spec specifies otherwise).

## 7. China network environment configuration

- npm → `https://registry.npmmirror.com`; GitHub accelerated → `gitclone.com`; Docker Hub not available → `quay.io`; MongoDB binary → `fastdl.mongodb.org`; Local large model → Ollama (ClashX `127.0.0.1:7890` proxy).
- Tools unify Homebrew management; support npm global installation.

## 8. Common engineering conventions

- **Ponytail philosophy**: shortest viable implementation; reuse > create new; root cause repair (one guard is better than patching every call point); do not build useless abstractions.
- **Front end**: SPA unified layout + zustand for state management; time processing dayjs; animation framer-motion; components preferentially use the installed UI library (antd / antd-x).
- **Backend**: NestJS-style modularization with Swagger documentation, DTO validation, and English error messages.
- **Commit**: Commit at feature granularity; messages use `feat(scope): description`.
- **Operation and maintenance pit**: After killing npm wrapper, the child process will still occupy the port → `lsof -ti :PORT` cleanup; dev server hot reload is not reliable for schema changes → manually `prisma generate` + restart after changing Prisma schema.
- **Dev environment**: unified startup script + README record (service list, port, account).

---

*This document is produced by the Wade AI (ai-workspace) project practice and can be freely copied to any new project for use in accordance with §2. *
