# API Contract Notes

## Stable patterns

| Topic | Contract |
|---|---|
| API prefix | `/api` |
| Error body | `{statusCode, message}` |
| List responses | Bare arrays for documented collection endpoints |
| Message pagination | `{items, nextCursor}` |
| Auth | JWT-based guards with server-side provider secrets |

## Usage rules

1. Web callers should adapt to the documented shapes, not infer new wrappers.
2. Contract changes belong in specs first and code second.
3. Permission semantics must stay explicit at the controller and service boundary.
4. Docs references should track the current swagger path at `/api/swagger`.

## Pending notes

- TODO: capture refresh-token contract details after Phase 9 backend merge.
- TODO: capture docs-browser dual-path compatibility notes if the API keeps both roots long term.
