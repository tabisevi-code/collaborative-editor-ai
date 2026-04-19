# Assignment 2 Current State

The repository is now in an Assignment 2 runnable state.

## Implemented

- FastAPI backend is the primary backend path
- register, login, refresh, logout, `/auth/me`, and local forgot-password/reset flow
- hashed passwords and JWT bearer auth
- protected document list, CRUD, permissions, versions, revert, and sessions
- realtime websocket session issuance from FastAPI
- backend-backed dashboard
- rich-text editor integrated into the main document page
- inline remote cursor and selection rendering
- share-by-link with configurable role and revocation
- export routes and UI
- real PDF export bytes
- real DOCX export bytes
- idempotent save, share-link creation, and revert routes
- Playwright browser E2E flow
- dedicated realtime regression tests for simultaneous insert conflicts and overlapping delete/insert conflicts
- root install/dev/test/demo scripts aligned to the final stack
- root integration smoke test aligned to FastAPI + realtime

## Remaining Risk Areas

- realtime still depends on the legacy Node schema/bootstrap module internally
- AI workstream is intentionally left reserved/unimplemented on this core branch

## Recent Hardening Notes

- WebSocket auth now uses a signed subprotocol token instead of a query-string token.
- Refresh-token rotation invalidates older access-token sessions immediately.
- Auth/session throttling is backed by the shared SQLite database rather than process-local memory.

## Submission Story

For evaluation, the repository should be treated as:

- FastAPI backend at `backend_fastapi/`
- React frontend at `frontend/`
- Node realtime relay at `realtime/`

The old Express backend is not the Assignment 2 runtime path.
