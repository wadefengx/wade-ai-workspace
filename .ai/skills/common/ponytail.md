---
name: ponytail
description: Team common skill—lazy engineering philosophy (smallest viable implementation, YAGNI, root-cause fixes).
owner: frontend
version: "1.0"
tags: [engineering, philosophy, all-roles]
inputs: [task, code]
outputs: [minimal-diff, decision]
depends: []
confidence: stable
---

# Ponytail

## The ladder

Evaluate in this order and stop at the first sufficient option:

1. Do not do it if it is unnecessary.
2. Reuse existing helpers, modules, and patterns.
3. Use the standard library.
4. Use native platform capabilities.
5. Use installed dependencies.
6. Use one line when one line works.
7. Only then write the smallest implementation.

## Bug fix = root-cause fix

- Trace the call chain first; fix the shared root cause rather than only the failing path.
- Prefer shared entry points, validations, and helpers to prevent recurrence in sibling paths.

## Rule

- Do not add unrequested abstractions.
- Deletion beats addition; reuse beats rewrites.
- The shortest diff wins, provided it correctly covers the real problem.
- Mark deliberate tradeoffs with a `ponytail:` comment and state known ceilings and the upgrade path.

## Do not simplify

- Input validation at trust boundaries.
- Data safety, permissions, and security-related handling.
- Capabilities, constraints, and acceptance items explicitly requested by the user or spec.

## Output style

- State the conclusion first, then necessary evidence.
- Control complexity: fewer files, abstractions, and boilerplate.
- Explain only key tradeoffs; do not restate the process.
