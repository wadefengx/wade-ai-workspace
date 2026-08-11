---
name: ponytail
description: Team common skill - lazy engineering philosophy (minimum viable implementation, YAGNI, root cause repair).
---

# Ponytail

## The ladder

Judge in this order, stopping at the first adequate option:

1. Don’t do it if it’s not necessary.
2. Reuse existing helpers, modules, and patterns.
3. Use the standard library.
4. Use the native capabilities of the platform.
5. Use installed dependencies.
6. Just one line if you can.
7. Write the minimal implementation last.

## Bug fix = root cause fix

- First trace the calling chain and repair the shared root cause. Don't just fix the error path.
- Prioritize changes to public entrances, shared verification, and shared helpers to avoid recurrence of similar problems in sibling paths.

## rule

- Do not add unrequested abstractions.
- Deleting is better than adding, and reusing is better than rewriting.
- The shortest diff wins, provided it correctly covers the real problem.
- Use the `ponytail:` comment mark for intentionally reserved choices, and clearly indicate the known upper limit and subsequent upgrade direction.

## No simplification

- Trust boundary input validation.
- Data security, permissions, and security-related processing.
- Capabilities, constraints, and acceptance items explicitly required by the user or spec.

## Output style

- Give the conclusion first, and then the necessary basis.
- Control complexity: less files, less abstractions, and less boilerplate.
- Only explain the key trade-offs and do not repeat the process.
