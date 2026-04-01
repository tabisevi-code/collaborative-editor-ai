# Collaborative Editor AI

A multi-service course project for collaborative document editing with AI-assisted writing workflows.

The repository contains a working end-to-end prototype with:

- document creation, loading, editing, and saving
- document-level roles (`owner`, `editor`, `viewer`)
- version history and revert
- permission management
- AI rewrite, summarize, and translate jobs
- export jobs
- realtime collaboration over WebSockets and Yjs
- SQLite-backed persistence for local development

## What This Repo Contains

This project is organized as a small monorepo:

- `frontend/`: React + TypeScript web client
- `backend/`: REST API, auth, RBAC, persistence, AI job orchestration, exports, session issuance
- `realtime/`: WebSocket collaboration service for live editing and presence
- `ai-service/`: provider adapter and AI execution core used by the backend
- `shared/`: shared notes and intended cross-service contracts
- `docs/`: architecture notes, diagrams, and ADRs
- `config/`: configuration references

## Architecture At A Glance

The runtime flow is:

1. The frontend talks to the backend over HTTP for document CRUD, history, permissions, AI jobs, exports, and realtime session creation.
2. The backend persists documents, versions, permissions, and AI jobs in SQLite.
3. The frontend opens a WebSocket connection to the realtime service using a backend-issued session.
4. The realtime service validates that session, enforces current permissions, and syncs Yjs document updates and awareness state.
5. AI requests are routed through the backend, which uses the provider code in `ai-service/` to call an OpenAI-compatible endpoint such as LM Studio.

## Current Product Shape

The current prototype is not a full Google Docs clone. A few important implementation notes:

- The stored document format is still plain text.
- The formatting toolbar in the frontend is functional, but it currently applies text markers such as `**bold**`, `*italic*`, `~~strike~~`, and list prefixes rather than true rich-text markup.
- Realtime collaboration is implemented at the text-sync layer with Yjs.
- AI suggestions are generated asynchronously and applied from the client side.

## Requirements

- Node.js `20+`
- npm `10+`

The repo also includes `.nvmrc` with the intended Node major version.

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../realtime && npm install
```

### 2. Configure the backend

The backend reads environment variables from `backend/.env`.

Create it from the example:

```bash
cd backend
cp .env.example .env
```

Important defaults:

- `PORT=3000`
- `DATABASE_PATH=./data/collaborative-editor-ai.sqlite`
- `REALTIME_WS_BASE_URL=ws://localhost:3001/ws`
- `REALTIME_SHARED_SECRET=collaborative-editor-ai-dev-secret`
- `AI_PROVIDER_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions`

If you do not have a local LLM provider running, the app will still work except for AI features.

### 3. Start the services

Start the backend:

```bash
cd backend
npm run dev
```

Start the realtime service in a second terminal:

```bash
cd realtime
npm run dev
```

Start the frontend in a third terminal:

```bash
cd frontend
npm run dev
```

Then open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Default Ports

- Frontend: Vite default, usually `5173`
- Backend: `3000`
- Realtime: `3001`

## Local Demo Flow

1. Open the frontend.
2. Sign in with a simple local user ID such as `user_1`.
3. Create a document.
4. Open the same document as another user, such as `user_2`, to verify sharing behavior.
5. Use the owner account to grant `editor` or `viewer` access.
6. Edit content and save a new revision.
7. Open version history and revert if needed.
8. Try AI rewrite, summarize, or translate if an AI provider is available.

## Authentication

The backend supports a lightweight local bearer-token flow:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_1"}'
```

When `ALLOW_DEBUG_USER_HEADER=true`, local development can also use the `x-user-id` header for convenience.

## Testing

Run tests per service:

### Backend

```bash
cd backend
npm test
```

Extra backend test entry points:

```bash
npm run test:unit
npm run test:contract
npm run test:smoke
```

### Frontend

```bash
cd frontend
npm test
npm run build
```

### Realtime

```bash
cd realtime
npm test
```

## API And Contract References

Useful backend references:

- REST contract summary: `backend/CONTRACT.md`
- OpenAPI document: `backend/docs/openapi.yaml`

## Repository Notes

- SQLite is the default and intended development database in this repo.
- The realtime service reads the same SQLite database as the backend for permission-sensitive collaboration behavior.
- The backend is currently the primary orchestration layer. The `ai-service/` folder provides the AI provider and job execution logic that the backend imports.
- There is no root-level workspace script orchestration yet; each service is started independently.

## Known Limitations

- Rich text is not stored as structured markup yet.
- AI features depend on an external OpenAI-compatible model endpoint being available.
- The repo is optimized for local development and coursework, not production deployment.

## Further Reading

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [Realtime README](./realtime/README.md)
- [AI Service README](./ai-service/README.md)
- [Architecture Docs](./docs/architecture/README.md)
