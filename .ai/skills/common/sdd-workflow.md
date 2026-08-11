---
name: sdd-workflow
description: Team-wide SDD workflow—operational steps from requirements and spec through development, QA, and knowledge capture.
owner: pm
version: "1.0"
tags: [workflow, delivery, planning, all-roles]
inputs: [task, spec]
outputs: [execution-plan, acceptance]
depends: []
confidence: stable
---

# SDD Workflow

## TriggersCondition

- A new phase, module, page, API, or cross-frontend/backend requirement.
- When multiple people/agents must collaborate in parallel.
- When requirement boundaries, permissions, or contracts may affect multiple modules.

## Steps

1. **Requirements**: the user provides a goal; PM clarifies goals, scope, boundaries, and non-goals.
2. **Analysis**: decompose roles, permissions, pages, interfaces, data, and dependencies.
3. **Architecture**: PM confirms routes, contracts, data models, and permission design with frontend and backend.
4. **Task split**: PM divides backend lanes, frontend lanes, and QA tasks and writes them into the spec.
5. **Spec**: produce `specs/SPEC-<phase>.md`; begin development only after review passes.
6. **Development**: frontend and backend implement to the spec, reusing existing patterns and components first.
7. **QA**: run lint/typecheck/test and key e2e checks from the acceptance checklist; record PASS/FAIL.
8. **Capture**: write common experience to `skills/`; put key conclusions in long-term memory/context.

## Deliverable paths

- `specs/SPEC-<phase>.md`:Formal spec for each phase.
- `specs/TEMPLATE.md`:Spec template.
- `skills/*.md`:Shared team skill knowledge.
- `docs/`: long-term architecture, database, and API descriptions; does not hold phase specs.

## Acceptance commands

```bash
npm run lint --workspace=@wade/api
npm run typecheck --workspace=@wade/api
npm test --workspace=@wade/api
npm run lint --workspace=@wade/web
npm run typecheck --workspace=@wade/web
npm test --workspace=@wade/web
```

- If the phase has dedicated scripts or e2e checks, add them to the acceptance checklist in its spec.

## Common Pitfalls

- When spec and implementation conflict, the spec prevails; update it to reflect the final decision.
- Changing code without updating spec/skill causes later agents to lose context.
- QA must not cover only the happy path; include permission isolation, empty states, error states, and regression flows.
- Put phase specs in `specs/`; do not mix them back into `docs/`.
