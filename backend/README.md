# Backend (SQLite + Auth + RBAC)

This backend is the main REST API for the Collaborative Editor AI project.

For repo-wide install, dev, and test commands, start from the root README:

```bash
npm run install:all
npm run dev:all
npm run test:all
```

It now includes:

- SQLite persistence
- local bearer auth MVP
- document-level RBAC
- document create/get/update
- version history and revert
- collaborator permission management
- AI policy + async AI job contracts
- export jobs
- realtime session issuance
- standard error schema and request correlation ids

## Requirements

- Node.js `20+`
- npm `10+`

## Setup

```bash
cd backend
npm install
```

## Environment

See `.env.example`.

Important defaults:

- `DATABASE_PATH=./data/collaborative-editor-ai.sqlite`
- `REALTIME_WS_BASE_URL=ws://localhost:3001/ws`
- `ALLOW_DEBUG_USER_HEADER=true`
- `AI_PROVIDER=stub`
- `AI_PROVIDER_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions`
- `AI_MODEL=local-model`
- `AI_TIMEOUT_MS=15000`

`AI_PROVIDER=stub` is the safest local/demo default. Set `AI_PROVIDER=lmstudio` if you want the backend to call a live OpenAI-compatible endpoint.

## Run

```bash
npm run dev
```

Expected startup log:

```json
{"ts":"...","level":"info","msg":"server_started","port":3000,"url":"http://localhost:3000","databasePath":"..."}
```

## Authentication

Formal auth uses bearer tokens:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_1"}'
```

Example response:

```json
{
  "userId": "user_1",
  "displayName": "user_1",
  "globalRole": "user",
  "accessToken": "token_user_1",
  "expiresIn": 86400
}
```

For local demo compatibility, `x-user-id` still works when `ALLOW_DEBUG_USER_HEADER=true`.

## Quick API flow

Login and save the token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_1"}' | jq -r '.accessToken')
```

Create a document:

```bash
curl -X POST http://localhost:3000/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Doc","content":"Hello"}'
```

Update document content:

```bash
curl -X PUT http://localhost:3000/documents/<DOCUMENT_ID>/content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"req_1","content":"Hello again","baseRevisionId":"rev_1"}'
```

Create a realtime session:

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId":"<DOCUMENT_ID>"}'
```

Queue an AI rewrite job from a client-side selection snapshot:

```bash
curl -X POST http://localhost:3000/ai/rewrite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentId":"<DOCUMENT_ID>",
    "selection":{"start":0,"end":5},
    "selectedText":"Hello",
    "contextBefore":"",
    "contextAfter":" world",
    "instruction":"Make it more formal",
    "baseVersionId":"<CURRENT_VERSION_ID>",
    "requestId":"req_ai_1"
  }'
```

## Tests

Run everything:

```bash
npm test
```

Run only contract tests:

```bash
npm run test:contract
```

Run only smoke:

```bash
npm run test:smoke
```

## Error schema

All non-2xx responses follow:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "invalid request body",
    "details": {}
  }
}
```

## Notes

- SQLite is the implementation database for this course project.
- The `realtime` service reads the same SQLite database for session validation and permission enforcement.
- AI jobs persist in SQLite, while the provider adapter currently targets LM Studio's OpenAI-compatible chat completions API.
- AI requests accept a selection snapshot plus minimal surrounding context so frontend draft text can be transformed without mutating the stored document directly.
