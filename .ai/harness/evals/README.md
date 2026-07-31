# Evals Harness

## Purpose

Store repeatable evaluation definitions for product, agent, or workflow behavior.

## Include

- Named scenarios with setup, action, and expected outcome.
- Small matrices that compare agent or workflow outputs.
- Eval notes that can become regression checks later.

## Exclude

- One-off smoke checks that have no reuse value.
- Large generated logs better kept outside the repo.

## Usage rules

1. Keep evals deterministic where possible.
2. Link each eval to the spec or workflow it measures.
3. Promote frequently reused evals into scorecards or regressions.
