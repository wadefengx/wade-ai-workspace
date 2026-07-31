# AGENTS.md — Zone AI Runtime Entry

## Mission

This repository runs as an AI Native, local-first workspace: specs define the contract, agents execute bounded lanes, and durable context is written back into memory, skills, knowledge, architecture, and harness artifacts so later sessions start smarter instead of colder.

## Context loading order

1. Root `AGENTS.md` or this mirror.
2. `.ai/organization/` for team model, routing, communication, and role contracts.
3. `.ai/runtime/` for context, prompt, model, tool, and coding policy.
4. Relevant `.ai/specs/` files for active scope; legacy `specs/` stays readable during migration.
5. Relevant `.ai/skills/` files for proven execution patterns; legacy `skills/` stays readable during migration.
6. `.ai/memory/` for durable facts, decisions, conventions, and known issues.
7. `.ai/architecture/`, `.ai/knowledge/`, and `.ai/harness/` when deeper reference is needed.

## AI lifecycle

`Requirement -> Spec -> Plan -> Impl -> Review -> Test -> Eval -> Memory -> Skill -> Knowledge`

## Directory map

- `.ai/organization/`: collaboration model and role contracts.
- `.ai/runtime/`: agent execution policy.
- `.ai/workflows/`: repeatable task flows.
- `.ai/specs/`: template and completed specs.
- `.ai/skills/`: reusable skills.
- `.ai/memory/`: durable project memory.
- `.ai/knowledge/`: curated reference.
- `.ai/architecture/`: overviews and ADRs.
- `.ai/harness/`: validation support assets.
