# Team Map

## Core roles

| Role | Primary mission | Main outputs | Default escalation |
|---|---|---|---|
| PM | Define scope, phasing, and acceptance | Spec, task briefs, release notes | Architect |
| Architect | Align contracts, modules, runtime, and tradeoffs | ADRs, architecture docs, guardrails | PM |
| UX | Clarify flows, information hierarchy, and interaction detail | UX notes, page rules, copy guidance | PM |
| Frontend | Implement web UX and client state | UI code, page behavior, frontend tests | Architect |
| Backend | Implement APIs, auth, data, and service flows | API code, schema, backend tests | Architect |
| QA | Validate spec behavior and regressions | Checklists, scripts, PASS/FAIL reports | PM |
| DevOps | Maintain local-first tooling, runners, and harness paths | Environment docs, scripts, CI hooks | Architect |

## Working model

1. PM owns the phase brief and keeps scope stable.
2. Architect settles shared contracts before parallel lanes branch.
3. Frontend and Backend work in parallel when contracts are fixed.
4. UX joins early on user-facing changes and reviews copy-sensitive flows.
5. QA validates against spec wording, not implementation intent.
6. DevOps keeps local-first commands reproducible for humans and agents.

## Handoff expectations

- Every lane receives a self-contained brief with paths, contracts, constraints, and validation commands.
- Blocking uncertainty escalates quickly; hidden assumptions do not.
- Shared files are sequenced or explicitly assigned to avoid conflict.
