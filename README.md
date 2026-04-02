# Collaborative Editor AI

Collaborative Editor AI is a small monorepo for collaborative document editing with AI-assisted writing workflows.

The current MVP includes:

- REST document APIs with auth, RBAC, versions, revert, exports, and AI jobs
- a React frontend wired to those APIs
- a dedicated realtime service that relays Yjs sync and awareness frames over WebSockets
- SQLite persistence shared by backend and realtime services

## Monorepo Layout

- `backend/`: Express API, auth, SQLite persistence, RBAC, AI job orchestration, exports, realtime session issuance
- `frontend/`: React + TypeScript client for documents, permissions, version history, AI, and live collaboration
- `realtime/`: WebSocket relay for Yjs sync, awareness, and backend-driven permission/revert events
- `ai-service/`: AI provider adapter and prompt execution logic imported by the backend
- `shared/`: shared contracts such as realtime session token signing
- `docs/`: ADRs, architecture notes, and diagrams
- `config/`: configuration notes

## Quickstart (3 Commands)

From the repo root:

```bash
npm run install:all
npm run dev:all
npm run test:all
```

Notes:

- `npm run dev:all` starts the backend, realtime service, and frontend together.
- `npm run test:all` runs backend, frontend, realtime, and a root integration smoke test.
- `npm run demo:reset` wipes the local SQLite database and starts a clean demo with the stub AI provider.
- The backend reads `backend/.env` if present. Copy `backend/.env.example` to `backend/.env` if you want local overrides.

## Demo Mode

For the most reliable live demo path:

```bash
npm run install:all
npm run demo:reset
```

The full step-by-step presenter script lives in [`DEMO.md`](./DEMO.md).

## Docker Compose

You can also run the whole stack in containers:

If Docker CLI is missing on macOS, install it with Homebrew:

```bash
brew install docker docker-compose
```

Then add the Compose plugin path to `~/.docker/config.json` so `docker compose` resolves the Homebrew plugin:

```json
{
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins"
  ]
}
```

```bash
docker compose up --build
```

When you want a clean slate again:

```bash
docker compose down -v
```

## Default Local Ports

- Frontend: `5173`
- Backend: `3000`
- Realtime: `3001`

## Service Commands

If you want to work on a single service directly:

### Backend

```bash
cd backend
npm install
npm run dev
npm test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
npm test
```

### Realtime

```bash
cd realtime
npm install
npm run dev
npm test
```

## Runtime Flow

1. The frontend authenticates through `POST /auth/login`.
2. The frontend uses the backend for document CRUD, permissions, versions, exports, AI jobs, and session creation.
3. The backend persists documents, versions, permissions, jobs, and realtime events in SQLite.
4. The frontend opens a WebSocket connection to the realtime service using the backend-issued session URL.
5. The realtime service validates that session, enforces current role, and relays Yjs sync and awareness updates.

## Manual Demo Flow

1. Run `npm run dev:all` from the repo root.
2. Open the frontend at `http://localhost:5173`.
3. Sign in as `user_1` and create a document.
4. Open the same document in a second browser as `user_2`.
5. Grant `editor` or `viewer` access from the owner account.
6. Verify live collaboration, presence, save/version history, and AI suggestion flows.

## Testing

Repo-wide:

```bash
npm run test:all
```

This runs:

- `backend` unit + smoke tests
- `frontend` Vitest suite
- `realtime` Node test suite
- a root integration smoke test that starts backend and realtime against a temp SQLite file

## Environment Notes

Important backend defaults:

- `PORT=3000`
- `DATABASE_PATH=./data/collaborative-editor-ai.sqlite`
- `REALTIME_WS_BASE_URL=ws://localhost:3001/ws`
- `REALTIME_SHARED_SECRET=collaborative-editor-ai-dev-secret`
- `AI_PROVIDER=stub`
- `AI_PROVIDER_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions`

`AI_PROVIDER=stub` is the safe local default. Switch to `AI_PROVIDER=lmstudio` if you want to exercise a real OpenAI-compatible model endpoint.

## Contracts And Docs

- Backend contract notes: `backend/CONTRACT.md`
- Backend OpenAPI: `backend/docs/openapi.yaml`
- Frontend details: `frontend/README.md`
- Backend details: `backend/README.md`
- Realtime details: `realtime/README.md`
- Architecture notes: `docs/architecture/README.md`

## Current Limitations

- Documents are stored as plain text, not structured rich-text markup.
- Rich formatting controls currently apply lightweight text markers and editor behaviors rather than a full document schema.
- AI depends on an external OpenAI-compatible endpoint.
- Services are intentionally simple and local-first for coursework rather than production deployment.
