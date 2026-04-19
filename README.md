# Collaborative Editor AI

Collaborative Editor AI is the final Assignment 2 monorepo for a collaborative document editor with JWT auth, realtime collaboration, a backend-streamed AI writing assistant, version restore, permissions, and exports.

## Final Stack

- `backend_fastapi/` — FastAPI backend with JWT auth, documents, AI streaming/history/policy, share links, exports, and `/docs`
- `frontend/` — React + TypeScript client
- `realtime/` — Yjs/WebSocket relay with signed session-token auth
- `shared/` — shared realtime session-token signing helpers

Bonus-tier features included in the runnable stack:

- share-by-link with configurable role and revocation
- optional revocation of access that was granted through a share link
- inline remote cursor and selection rendering
- browser E2E coverage with Playwright
- real PDF export bytes
- real DOCX export bytes
- per-user AI quota visibility and idempotent write routes

The legacy `backend/` directory remains only as migration/reference code for the realtime service bootstrap and prior coursework history. The Assignment 2 runnable path is FastAPI-first.

## Requirements

- Python 3.11+
- Node.js 20+
- npm 10+
- Docker optional

## Evaluator Quickstart

```bash
npm run install:all
npm run test:all
npm run dev:all
```

Open:

- Frontend: `http://localhost:5173`
- FastAPI docs: `http://localhost:8000/docs`

## One-Command Paths

- Install everything: `npm run install:all`
- Run the full stack: `npm run dev:all`
- Run all tests: `npm run test:all`

Optional browser E2E runs:

- `cd frontend && AI_STREAM_PROVIDER=stub npm run test:e2e`
- `cd frontend && AI_STREAM_PROVIDER=lmstudio npm run test:e2e`

Equivalent wrappers:

- `make`
- `make install`
- `make run`
- `make test`

## Demo Flow

1. Register a user or sign in with an existing account.
2. Create a document from the dashboard.
3. Open the same document in a second browser as another user.
4. Grant editor access from the owner account.
5. Verify live collaboration.
6. Edit rich text and observe autosave.
7. Run AI rewrite, summarize, and translate on selected text.
8. Show streaming output, cancellation, and suggestion apply/reject flow.
9. Show AI history and AI policy/quota controls.
10. Create and revoke a share link.
11. Show inline remote cursor/selection rendering in a second browser.
12. Revert using version history.
13. Export the document as PDF or DOCX.

## Testing

`npm run test:all` runs:

- FastAPI backend tests
- frontend Vitest suite
- realtime Node test suite
- root full-stack smoke test against FastAPI + realtime

Optional browser coverage:

- `cd frontend && AI_STREAM_PROVIDER=stub npm run test:e2e`
- `cd frontend && AI_STREAM_PROVIDER=lmstudio npm run test:e2e`

## Environment

See:

- root `.env.example`
- `backend_fastapi/.env.example`

Important:

- keep JWT and realtime secrets out of the repository
- `npm run dev:all` generates ephemeral local secrets if you do not provide them
- `docker compose` expects you to provide `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`, and `REALTIME_SHARED_SECRET`
- browser access from `http://localhost:5173` is allowed by FastAPI CORS via `FRONTEND_ALLOWED_ORIGINS`
- realtime websocket auth uses a signed subprotocol token rather than a query-string token
- auth/session throttling is backed by the shared SQLite database

Default local ports:

- FastAPI: `8000`
- Realtime: `3001`
- Frontend: `5173`

## Docker

```bash
docker compose up --build
```

This starts the FastAPI backend, realtime service, and frontend against a shared SQLite volume.

## Documentation

- Assignment 2 contracts: `docs/assignment2-contracts.md`
- Current state: `docs/assignment2-current-state.md`
- Deviations: `DEVIATIONS.md`
- Assignment 2 report package: `assignment2-report/`
- Historical Assignment 1 report package: `final-report/`
