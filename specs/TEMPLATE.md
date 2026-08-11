# SPEC-Phase X — <Feature Title>

Version: 0.1 (YYYY-MM-DD)

## 1. Goals

1. Clearly state the business objective and user value this phase must deliver.
2. Describe the success criteria for this phase to prevent implementation drift.
3. Mark dependencies and handoffs with preceding phases.

## 2. Scope and Non-goals

### Scope

- Features, pages, APIs, and permission boundaries included in this phase.
- Existing modules and data that need integration.

### Non-goals

- Explicitly deferred items, preventing scope creep.
- Known related issues or enhancements that this phase will not address.

## 3. Role Model and Permissions

| Role | Description | Read permission | Write permission | Special restrictions |
|------|-------------|-----------------|------------------|----------------------|
| OWNER | Workspace creator / highest role | Example | Example | Cannot be removed/demoted |
| ADMIN | Workspace administrator | Example | Example | Cannot operate on OWNER |
| MEMBER | Ordinary member | Example | Example | Authorized capabilities only |

- Clearly document the relationship between global-administrator and Workspace roles.
- Principle of least privilege: `OWNER > ADMIN > MEMBER`.
- Document Guards, member checks, error codes, and exceptions here when relevant.

## 4. API Contract

### Routes

```txt
GET    /api/...
POST   /api/...
PATCH  /api/...
DELETE /api/...
```

### Request/Response Conventions

- List APIs return bare arrays by default; paginated messages return `{items, nextCursor}`.
- Standard error format: `{statusCode, message}`.
- Specify request bodies, key response fields, permission requirements, status codes, and error cases.

## 5. Implementation Details

### Backend

- Changes to modules/services/controllers/Guards/repositories/Prisma.
- Reuse existing capabilities and shared helpers; avoid duplicate implementations.
- When AI/configuration/permissions interact, document the call chain and priority.

### Frontend

- Page entry points, routes, component reuse, state management, and API integration points.
- UI behavior, empty/error/permission states, and success feedback.
- Compatibility requirements with the existing layout, navigation, theme, and contracts.

## 6. Task Breakdown

### PM

- Define scope, boundaries, and non-goals.
- Maintain the spec and acceptance checklist.

### Backend lane

- List API/data-model/permission/test tasks.

### Frontend lane

- List page/component/interaction/state/test tasks.

### QA

- List API acceptance, regression paths, e2e scenarios, and permission-verification points.

## 7. Acceptance Checklist

1. `npm run lint --workspace=@wade/api`
2. `npm run typecheck --workspace=@wade/api`
3. `npm test --workspace=@wade/api`
4. `npm run lint --workspace=@wade/web`
5. `npm run typecheck --workspace=@wade/web`
6. `npm test --workspace=@wade/web`
7. Validate each critical browser/e2e path for this phase and record PASS/FAIL.

## 8. Change Record

| Date | Version | Change | Owner |
|------|------|--------|-------|
| YYYY-MM-DD | 0.1 | Initial spec | PM |
