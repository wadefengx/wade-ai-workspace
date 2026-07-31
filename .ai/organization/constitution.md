# AIOS Constitution

## Purpose

This repository runs as an AI Native system: people define intent, AI agents execute lanes, and the repository keeps reusable context close to the work.

## Object model

| Object | Question answered | Canonical home | Typical owner |
|---|---|---|---|
| Organization | Who collaborates and under which rules | `.ai/organization/` | PM + Architect |
| Specification | What should be built and what is out of scope | `.ai/specs/` | PM |
| Workflow | How work moves from request to acceptance | `.ai/workflows/` | PM + QA |
| Knowledge | What durable reference the repo knows | `.ai/knowledge/` | All lanes |
| Runtime | How agents load context, pick models, and use tools | `.ai/runtime/` | Architect + DevOps |

## Cross-cutting systems

| System | Role across the lifecycle |
|---|---|
| Memory | Stores project facts, decisions, conventions, and known issues |
| Skill | Captures reusable execution patterns after repeated success |
| Harness | Supplies evals, fixtures, regressions, prompts, and scorecards |

## Operating rules

1. Organization sets the collaboration frame before implementation starts.
2. Specification is the source of truth when code and narrative disagree.
3. Workflow defines mandatory handoffs, validation, and update points.
4. Knowledge is curated reference, not a dump of transient notes.
5. Runtime policy guards model choice, prompt shape, tool use, and coding behavior.
6. Memory, Skill, and Harness are updated whenever a phase produces reusable learning.
