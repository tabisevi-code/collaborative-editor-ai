# Backend PoC (Node + Express)

This backend implements the graded PoC API contract:

- `POST /documents`
- `GET /documents/:documentId`

It also includes:

- `GET /health`
- request correlation id (`X-Request-Id`)
- structured JSON logs
- standard error schema for all non-2xx responses
- zod request validation
- payload limits
- contract test suite (`npm run test:contract`)
- smoke test (`npm run test:smoke`)
- OpenAPI spec (`docs/openapi.yaml`)
- contract lock (`CONTRACT.md`)

## Requirements

- Node.js `20+`
- npm `10+`

## Setup

```bash
cd backend
npm install
```

## Run

```bash
npm run dev
```

Expected startup log:

```json
{"ts":"...","level":"info","msg":"server_started","port":3000,"url":"http://localhost:3000"}
```

## Quick API test (curl)

Create document:

```bash
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -H "x-user-id: user_1" \
  -d '{"title":"Test Doc","content":"Hello"}'
```

Expected status: `201`

Get document:

```bash
curl http://localhost:3000/documents/<DOCUMENT_ID> \
  -H "x-user-id: user_1"
```

Expected status: `200`

## Automated tests

Run from `backend/`:

```bash
npm test
```

What `npm test` runs:

- `npm run test:contract`: end-to-end contract tests for health, POST, GET, and error schema.
- `npm run test:smoke`: quick POST -> GET sanity check.

Run only the contract suite:

```bash
npm run test:contract
```

Run only smoke:

```bash
npm run test:smoke
```

By default, smoke starts its own temporary server and validates POST -> GET.

If you want to test a running server:

```bash
BASE_URL=http://localhost:3000 npm run test:smoke
```

## Environment variables

See `.env.example` for available variables and defaults.

- `PORT` (default: `3000`)
- `JSON_BODY_LIMIT` (default: `1mb`)
- `DOCUMENT_CONTENT_MAX_BYTES` (default: `204800`)

Example:

```bash
PORT=4000 npm run dev
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

## Troubleshooting

If you see `Cannot find module ...`:

1. Run `npm install` inside `backend/`
2. Confirm required files exist under `src/services` and `src/storage`
3. Check import paths for typos and folder-name mismatches
4. Re-run `npm run dev`

If request body errors appear:

- invalid JSON -> `INVALID_JSON`
- invalid shape -> `INVALID_INPUT`
- oversized body/content -> `PAYLOAD_TOO_LARGE`
