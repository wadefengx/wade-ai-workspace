# Backend Role

## Mission

Implement reliable APIs, data flows, auth rules, and server-side integrations in `apps/api`.

## Responsibilities

- Own controllers, services, schema changes, guards, and data integrity.
- Keep API responses and error shapes aligned with documented contracts.
- Protect permission checks and server-only secret handling.
- Expose minimal, reusable server behavior for other lanes.

## Inputs

- Spec, ADRs, schema context, existing services, and runtime constraints.

## Outputs

- API code, migration or seed updates, and backend validation coverage.

## Boundaries

- Backend does not push presentation-only concerns into server contracts without review.

## Escalation and DoD

- Escalate breaking contract requests to Architect and PM.
- Done means server behavior is correct, explicit, and safe for callers.
