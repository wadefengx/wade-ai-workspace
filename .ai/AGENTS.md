# AGENTS.md — Wade AI Runtime Entry

## Mission

This repository runs as an AI Native, local-first workspace: specs define the contract, agents execute bounded lanes, and durable context is written back into memory, skills, knowledge, architecture, and harness artifacts so later sessions start smarter instead of colder.

## Context loading order

1. Root `AGENTS.md` or this mirror.
2. `.ai/runtime/AI_INSTRUCTION_V2.md` — **Runtime Operating Model 2.0**(Goal-First / Skill Triggering / Dynamic Subagents / Verification Iron Law / Self-Evolution Loop / Governance). When this document conflicts with v2, v2 takes precedence.
3. `.ai/organization/` for team model, routing, communication, and role contracts.
4. `.ai/registry/` for stable indexes before scanning deeper trees.
5. `.ai/runtime/` for context, prompt, model, tool, coding policy, and pipeline.
6. Relevant `.ai/specs/` files for active scope; legacy `specs/` stays readable during migration.
7. Relevant `.ai/skills/` files for proven execution patterns; legacy `skills/` stays readable during migration.
8. `.ai/memory/` for durable facts, decisions, conventions, and known issues.
9. `.ai/architecture/`, `.ai/knowledge/`, and `.ai/harness/` when deeper reference is needed.

## AI lifecycle

`Requirement -> Spec -> Plan -> Impl -> Review -> Test -> Eval -> Memory -> Skill -> Knowledge`

## Directory map

- `.ai/organization/`: collaboration model and role contracts.
- `.ai/registry/`: runtime lookup indexes for skills, workflows, roles, tools, and models.
- `.ai/runtime/`: agent execution policy, planner, lane state, confidence, DAG, backlog, and learning loops.
- `.ai/workflows/`: repeatable task flows.
- `.ai/specs/`: template and completed specs.
- `.ai/skills/`: reusable skills.
- `.ai/memory/`: durable project memory.
- `.ai/knowledge/`: curated reference.
- `.ai/architecture/`: overviews and ADRs.
- `.ai/harness/`: validation support assets.

## Runtime defaults

- Standard execution path: `runtime/pipeline.md`
- Planner split rule: `runtime/planner.md`
- Lane state machine: `runtime/lane-states.md`
- Confidence gate: `runtime/confidence.md`
- Task DAG: `runtime/dependency-graph.md`
- Backlog queues: `runtime/backlog.md`
- Review workflow: `workflows/review.md`
- Memory to skill: `runtime/memory-to-skill.md`
- Index-first lookup: `registry/README.md`
- Task topology: `organization/topology.md`
