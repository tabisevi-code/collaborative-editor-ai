# Frontend

The frontend is the React + TypeScript client for the final Assignment 2 stack.

Implemented today:

- real FastAPI-backed registration and login
- JWT session restore and refresh handling
- backend-backed dashboard for owned/shared documents
- create and open documents
- role-aware editing (`owner`, `editor`, `viewer`)
- live collaboration over Yjs + WebSockets
- version history and revert flows
- permission management
- share-by-link acceptance flow
- inline remote cursor and selection rendering
- backend-streamed AI rewrite, summarize, and translate suggestion flows
- AI history and feedback tracking
- export controls and document metadata panels

For repo-wide install, dev, and test commands, start from the root README:

```bash
npm run install:all
npm run dev:all
npm run test:all
```

## Local Frontend Commands

```bash
cd frontend
npm install
npm run dev
npm test
npm run test:e2e
```

## Environment

Create `frontend/.env` only if you need a non-default backend URL:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

If omitted, the frontend defaults to `http://localhost:8000`.

## Manual Smoke Flow

1. Start the full stack from the repo root with `npm run dev:all`.
2. Open the frontend at the Vite URL, usually `http://localhost:5173`.
3. Register or sign in as `user_1` and create a document.
4. Open the same document in another browser or tab as `user_2`.
5. Use the owner account to grant `editor` or `viewer` access.
6. Confirm live cursor/presence updates and collaborative text sync.
7. Create and accept a share link in another browser.
8. Save a revision, open version history, preview a snapshot, and try revert.
9. Use an AI action and show streamed output, cancel, and AI history.

Useful demo/testing identifiers:

- `user_1`
- `user_2`
- `user_3`

Each browser tab keeps its own session user so two-user demos can be done in separate tabs without logging out globally.
