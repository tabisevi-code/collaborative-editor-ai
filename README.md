# Collaborative Editor AI

Collaborative Editor AI is a monorepo implementation of a collaborative document editor with AI-assisted writing workflows.

The MVP includes:

- REST document APIs with authentication, RBAC, version history, revert, export, and AI jobs
- A React frontend connected to those APIs
- A dedicated realtime service relaying Yjs synchronization and awareness over WebSockets
- SQLite persistence shared between backend and realtime services

---

## Requirements

- Node.js >= 20  
- npm >= 10  
- Docker (optional, for containerized execution)

---

## Evaluator Quickstart

Fastest way to validate the MVP:

npm run install:all
npm run demo:reset
npm run test:all

Then open:

Frontend: http://localhost:5173  
Swagger / OpenAPI UI: http://localhost:3000/docs/

Recommended quick feature check:

1. Sign in as user_1
2. Create a document
3. Open the same document in a second tab as user_2
4. Grant editor access from user_1
5. Verify live editing in both tabs
6. Observe autosave
7. Run an AI action and apply the result
8. Open version history and revert
9. Export the document

If ports 3000, 3001, or 5173 are already in use, run:

npm run demo:reset

This stops stale processes and resets the local SQLite database.

---

## Monorepo Layout

backend/ — Express API, authentication, RBAC, SQLite persistence, AI orchestration, exports, realtime session issuance  
frontend/ — React + TypeScript client for documents, permissions, versions, AI, and live collaboration  
realtime/ — WebSocket relay for Yjs sync, awareness, and permission enforcement  
ai-service/ — AI provider adapter and prompt execution logic  
shared/ — Shared contracts (e.g., realtime session signing)  
docs/ — ADRs, architecture notes, diagrams  
config/ — Configuration notes  
final-report/ — Final submission documentation package  

---

## Quickstart (Local Development)

From the repository root:

npm run install:all
npm run dev:all
npm run test:all

dev:all starts backend, realtime service, and frontend together.  
test:all runs backend, frontend, realtime, and integration smoke tests.  
demo:reset wipes the SQLite database and resets ports.

The backend reads backend/.env if present. Copy backend/.env.example to backend/.env for local overrides.

---



## Service Commands

### Backend

cd backend  
npm install  
npm run dev  
npm test  

### Frontend

cd frontend  
npm install  
npm run dev  
npm test  

### Realtime

cd realtime  
npm install  
npm run dev  
npm test  

---

## Runtime Flow

1. The frontend authenticates using POST /auth/login.
2. The frontend performs document CRUD, permissions, versioning, AI jobs, exports, and session creation via the backend API.
3. The backend persists documents, versions, permissions, AI jobs, and metadata in SQLite.
4. The frontend requests a realtime session using POST /sessions.
5. The frontend opens a WebSocket connection to the realtime service using the backend-issued session URL.
6. The realtime service validates the signed session token, enforces role-based access, and relays Yjs synchronization and awareness updates.

All REST endpoints and WebSocket session issuance are protected by backend-issued bearer tokens.

---

## Testing

Repo-wide:

npm run test:all

This runs:

- Backend unit + smoke tests
- Frontend Vitest suite
- Realtime Node test suite
- Root integration smoke test that validates cross-service behavior

All tests must pass before submission.

---

## Environment Configuration

Important backend defaults:

PORT=3000  
DATABASE_PATH=./data/collaborative-editor-ai.sqlite  
REALTIME_WS_BASE_URL=ws://localhost:3001/ws  
REALTIME_SHARED_SECRET=collaborative-editor-ai-dev-secret  
AI_PROVIDER=stub  
AI_PROVIDER_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions  

AI_PROVIDER=stub is the safe local default.

Switch to AI_PROVIDER=lmstudio if you want to exercise a real OpenAI-compatible model endpoint.

---

## Documentation

Backend contract notes: backend/CONTRACT.md  
Backend OpenAPI: backend/docs/openapi.yaml  
Architecture notes and ADRs: docs/  
Final report package: final-report/  

---

## Current Limitations

- Documents are stored as plain text, not structured rich-text markup.
- Formatting is simplified for coursework scope.
- AI depends on an external OpenAI-compatible endpoint.
- Services are intentionally local-first and simplified for academic evaluation.
