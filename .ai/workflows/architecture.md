# Architecture Workflow

## Input

- Cross-cutting requirement, contract conflict, or platform decision request.

## Execution

1. Identify the affected modules, contracts, and runtime implications.
2. Check existing ADRs before opening a new direction.
3. Compare the smallest viable options and reject scope creep early.
4. Write or update an ADR when the decision changes durable architecture.
5. Feed resulting constraints back into specs, runtime docs, or team routing.

## Output

- ADR, architecture doc updates, and constraints for implementation lanes.

## Validation

- Verify the chosen path fits current modules, tooling, and local-first constraints.

## Memory and skill

- Store the decision summary in memory and extract a skill only if execution repeats.
