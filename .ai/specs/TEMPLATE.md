---
status: draft
phase: Phase X
owner: PM
updated: YYYY-MM-DD
---

# SPEC-Phase X — <Feature Title>

Version: 0.1 (YYYY-MM-DD)

## 1. Goals

1. Clearly define the business objective and user value to be addressed in this phase.
2. Describe this phase's success criteria to prevent implementation drift.
3. Identify its relationship to preceding phases.

## 2. Scope and Exclusions

### Scope

- Features, pages, endpoints, and permission boundaries included in this phase.
- Existing modules and data that must be integrated.

### Exclusions

- Clearly state deferred items to avoid scope creep.
- Record known related issues or enhancements that this phase will not address.

## 3. Role Model and Permissions

| Role | Description | Read Permission | Write Permission | Special Restrictions |
|------|------|--------|--------|----------|
| OWNER | Workspace creator / highest role | Example | Example | Cannot be removed or demoted |
| ADMIN | Workspace administrator | Example | Example | Cannot operate on OWNER |
| MEMBER | Regular member | Example | Example | Limited to granted capabilities |

- Clearly describe the relationship between global administrators and workspace roles.
- Least-privilege principle: OWNER > ADMIN > MEMBER.
- Document guards, member validation, and error codes here when involved.

## 4. API Contract

### Routes

```txt
GET    /api/...
POST   /api/...
PATCH  /api/...
DELETE /api/...
```

### Request/Response Conventions

- List endpoints return bare arrays by default; paginated messages return `{items, nextCursor}`.
- Errors consistently use `{statusCode, message}`.
- Specify the request body, key response fields, permission requirements, status codes, and error scenarios.

## 5. Implementation Details

### Backend

- Changes to modules/services/controllers/guards/repositories/Prisma.
- Reuse existing capabilities and shared helpers; avoid duplicate implementations.
- If AI/configuration/permission integration is involved, specify the call chain and precedence.

### Frontend

- Page entry points, routes, component reuse, state management, and API integration points.
- UI behavior, empty/error/permission states, and success feedback.
- Compatibility requirements with existing layouts, navigation, themes, and contracts.

## 6. Task Breakdown

### PM

- Define scope, boundaries, and exclusions.
- Maintain the spec and acceptance checklist.

### Backend lane

- List API/data model/permission/test tasks.

### Frontend lane

- List page/component/interaction/state/test tasks.

### QA

- List API acceptance, regression paths, e2e scenarios, and permission-validation points.

## 7. Acceptance Checklist

1. `npm run lint --workspace=@wade/api`
2. `npm run typecheck --workspace=@wade/api`
3. `npm test --workspace=@wade/api`
4. `npm run lint --workspace=@wade/web`
5. `npm run typecheck --workspace=@wade/web`
6. `npm test --workspace=@wade/web`
7. Verify each key browser/e2e path for this phase and record PASS/FAIL.

## 8. Change Log

| Date | Version | Change | Owner |
|------|------|------|--------|
| YYYY-MM-DD | 0.1 | Initial spec | PM |
