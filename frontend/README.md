# Frontend

The frontend is a React + TypeScript client for the Collaborative Editor AI MVP.

Implemented today:

- login by local user id
- create and open documents
- role-aware editing (`owner`, `editor`, `viewer`)
- live collaboration over Yjs + WebSockets
- version history and revert flows
- permission management
- AI rewrite, summarize, and translate suggestion flows
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
```

## Environment

Create `frontend/.env` only if you need a non-default backend URL:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

If omitted, the frontend defaults to `http://localhost:3000`.

## Manual Smoke Flow

1. Start the full stack from the repo root with `npm run dev:all`.
2. Open the frontend at the Vite URL, usually `http://localhost:5173`.
3. Sign in as `user_1` and create a document.
4. Open the same document in another browser as `user_2`.
5. Use the owner account to grant `editor` or `viewer` access.
6. Confirm live cursor/presence updates and collaborative text sync.
7. Save a revision, open version history, and try revert.
8. Use an AI action if an OpenAI-compatible provider is configured.
