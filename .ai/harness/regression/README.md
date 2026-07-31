# Regression Harness

## Purpose

Store minimal artifacts that reproduce previously fixed bugs or protect high-risk flows.

## Include

- Repro steps, tiny scripts, or sample payloads for fixed issues.
- References to the spec, known issue, or changelog entry tied to the bug.
- Checks that fail clearly when the bug returns.

## Exclude

- Full end-to-end suites that belong in existing test locations.
- Broken artifacts with no owner or no current signal.

## Usage rules

1. Prefer the smallest failing proof.
2. Name the regression after the behavior, not the internal guess.
3. Remove or archive dead checks when product behavior changes intentionally.
