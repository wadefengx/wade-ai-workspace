# Collaboration Protocol

## Message format

| Part | Required content |
|---|---|
| Goal | Desired outcome in one sentence |
| Scope | Paths, contracts, and non-goals |
| Constraints | Forbidden edits, env limits, review rules |
| Acceptance | Commands, checks, or observable outcomes |
| Escalation | Who to notify when blocked |

## Communication rules

1. Lead with the result, then the supporting detail.
2. Use concrete paths, APIs, and contracts instead of vague area names.
3. Record assumptions only when they affect scope or correctness.
4. Raise blockers early; do not silently narrow the requirement.
5. Keep review comments actionable, high-signal, and tied to the spec.
6. Document durable conclusions in memory, not in ephemeral chat only.

## Review etiquette

- PM reviews for scope and acceptance coverage.
- Architect reviews for contracts, runtime policy, and system fit.
- Lane owners review implementation specifics in their areas.
- QA reports PASS or FAIL against the spec language.
