# Fixtures Harness

## Purpose

Store small reusable inputs, payload shapes, and reference samples for validation work.

## Include

- Minimal request or response examples.
- Sample markdown, JSON, or structured text used by tests or evals.
- Stable artifacts that make regressions easier to reproduce.

## Exclude

- Secrets, credentials, or bulky generated datasets.
- Fixtures that duplicate app seed data without a clear reason.

## Usage rules

1. Keep fixtures minimal and named by purpose.
2. Document any required consumer or workflow nearby.
3. Delete dead fixtures when nothing references them.
