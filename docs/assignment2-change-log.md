# Assignment 2 Change Log

This file summarizes the major implementation changes between the earlier Assignment 1 design/runtime state and the final Assignment 2 submission state.

`DEVIATIONS.md` explains why the design changed. This file gives a direct operational summary of what was added or upgraded.

## Backend And Security

- replaced the earlier backend runtime path with `backend_fastapi/` as the authoritative backend
- added JWT register/login/refresh/logout flow
- added hashed password storage using `pbkdf2_sha256`
- added local forgot-password/reset-password flow
- hashed refresh tokens before persistence
- tied access tokens to refresh-token sessions so refresh invalidates older access-token sessions
- moved websocket auth to signed subprotocol tokens rather than query-string tokens
- added database-backed auth/session throttling

## Documents, Sharing, And Versions

- implemented document create/load/save against FastAPI
- added role-based permissions (`owner`, `editor`, `viewer`)
- added share-by-link with revocation
- added optional revocation of access granted through share links
- implemented version history listing and revert
- added idempotent save/share/revert routes

## Realtime Collaboration

- kept the Yjs relay as a separate service
- integrated FastAPI-issued collaboration sessions with realtime auth
- fixed collaboration/auth database alignment
- added remote cursor and selection rendering in the frontend
- added explicit realtime regression tests for simultaneous insert and overlapping delete/insert conflicts

## AI Features

- implemented backend-streamed rewrite, summarize, and translate
- added provider abstraction and prompt modules
- added AI history
- added AI policy and quota usage
- added cancellation and feedback flows
- improved AI panel UX with non-modal behavior and instruction controls
- blocked stale AI apply when the source text changes under collaboration

## Exports

- implemented TXT and JSON export
- implemented real PDF export
- implemented real DOCX export
- preserved async export orchestration for longer-running file generation

## Testing And Evaluation

- backend pytest coverage
- frontend Vitest coverage
- realtime Node test coverage
- root integration smoke test
- Playwright browser coverage
- headless Playwright regression for stale AI apply under collaboration

## Repository And Submission Packaging

- added root `README.md` aligned with the final runtime
- added `DEVIATIONS.md`
- added Assignment 2 API contract notes
- added `.env.example` files
- added Makefile/run script one-command startup path
- added a dedicated `assignment2-report/` package while preserving Assignment 1 materials as historical artifacts
