---
name: sdd-workflow
description: The team's common SDD workflow - operational steps from requirements, spec, development to QA and precipitation.
---

# SDD Workflow

## Trigger conditions

- New phases, new modules, new pages, new APIs or cross-front-end and back-end linkage requirements.
- When multiple people/multiple agents need to collaborate in parallel.
- When requirement boundaries, permissions, and contracts may affect multiple modules.

## Steps

1. **Requirements**: The user proposes a goal, and the PM clarifies the goal, scope, boundaries, and non-doing items.
2. **System classification**: Separate roles, permissions, pages, interfaces, data and dependencies.
3. **Architecture**: PM combines front-end and back-end to confirm routing, contracts, data models, and permission schemes.
4. **Split tasks**: PM is split into back-end lane, front-end lane, and QA tasks, and written into spec.
5. **spec**: Output `specs/SPEC-<phase>.md`, which will be developed after passing the review.
6. **Development**: The front and back ends are implemented according to the spec, and priority is given to reusing existing models and components.
7. **QA**: Run lint/typecheck/test and key e2e according to the acceptance list, and record PASS/FAIL.
8. **Precipitation**: General experience is written into `skills/`, and key conclusions are written into long-term memory/context.

## Output path

- `specs/SPEC-<phase>.md`: Official spec for each issue.
- `specs/TEMPLATE.md`:spec template.
- `skills/*.md`: Team general skill precipitation.
- `docs/`: Long-term architecture, database, API description, does not carry phase spec.

## Acceptance command

```bash
npm run lint --workspace=@wade/api
npm run typecheck --workspace=@wade/api
npm test --workspace=@wade/api
npm run lint --workspace=@wade/web
npm run typecheck --workspace=@wade/web
npm test --workspace=@wade/web
```

- If there is a special script or e2e in this issue, add it to the acceptance list of the corresponding spec.

## Common pitfalls

- When spec conflicts with implementation, spec shall prevail and spec shall be updated simultaneously to reflect the final decision.
- Only changing the code without adding spec/skill will cause subsequent agents to lose context.
- QA can't just look at the happy path, but also cover permission isolation, empty states, error states, and return links.
- Phase spec is placed in `specs/`, do not mix it back into `docs/`.
