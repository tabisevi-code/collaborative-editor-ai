# Backend Contract Notes

> Historical legacy contract notes for the earlier Node/Express backend.
> These are not the authoritative Assignment 2 contracts.
> For the final submission, use `docs/assignment2-contracts.md` and `backend_fastapi/`.

This project no longer uses the original in-memory PoC contract only.

The current backend contract centers around:

- `POST /auth/login`
- `POST /documents`
- `GET /documents/:documentId`
- `PUT /documents/:documentId/content`
- `GET /documents/:documentId/versions`
- `POST /documents/:documentId/revert`
- `GET|PUT|DELETE /documents/:documentId/permissions...`
- `POST /sessions`
- `POST /ai/*`
- `GET /ai/jobs/:jobId`
- `POST /documents/:documentId/export`
- `GET /exports/:jobId`

## POST /ai/rewrite|summarize|translate

Requests must include the client-side selection snapshot:

```json
{
  "documentId": "doc_123",
  "selection": { "start": 0, "end": 5 },
  "selectedText": "Hello",
  "contextBefore": "",
  "contextAfter": " world",
  "baseVersionId": "ver_123",
  "requestId": "req_ai_1"
}
```

Rewrite requests also require `instruction`.
Translate requests also require `targetLanguage`.

Successful job responses use this stable shape:

```json
{
  "jobId": "aijob_123",
  "statusUrl": "/ai/jobs/aijob_123",
  "status": "PENDING|RUNNING|SUCCEEDED|FAILED",
  "baseVersionId": "ver_123",
  "proposedText": "Only present once the job succeeds",
  "errorCode": "Only present once the job fails",
  "errorMessage": "Only present once the job fails",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Stable response fields that frontend and tests depend on:

## POST /documents

```json
{
  "documentId": "doc_123",
  "title": "Untitled",
  "ownerId": "user_1",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "currentVersionId": "ver_xxx"
}
```

## GET /documents/:documentId

```json
{
  "documentId": "doc_123",
  "title": "Untitled",
  "content": "Latest text",
  "updatedAt": "ISO-8601",
  "currentVersionId": "ver_xxx",
  "role": "owner|editor|viewer",
  "revisionId": "rev_n"
}
```

## Standard Error Schema

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "human readable message",
    "details": {}
  }
}
```

## POST /sessions

```json
{
  "sessionId": "sess_123",
  "wsUrl": "ws://localhost:3001/ws?token=...",
  "role": "owner|editor|viewer"
}
```

## Realtime Protocol Notes

The frontend and realtime service currently rely on this stable split:

- binary Yjs frames:
  - type `0` = sync
  - type `1` = awareness
- JSON control messages:
  - `session_ready`
  - `permission_updated`
  - `document_reverted`
  - `access_revoked`
  - `error`
  - `ping` / `pong`

The backend issues the signed `wsUrl` via `POST /sessions`, and the realtime service validates that token before joining the document room.
