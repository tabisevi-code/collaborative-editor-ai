# Assignment 2 Contracts

This document freezes the core Assignment 2 contracts before full implementation so frontend, backend,
AI, and realtime work can evolve without drifting.

It is intentionally concrete and implementation-facing.

## 1. Authentication Contracts

### POST /auth/register

Purpose:
- Create a new user account with a securely hashed password.

Request JSON:

```json
{
  "identifier": "user_1",
  "displayName": "User One",
  "password": "demo-pass-123"
}
```

Success response (201):

```json
{
  "userId": "user_1",
  "displayName": "User One",
  "accessToken": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "expiresIn": 1200
}
```

Common errors:
- `400 INVALID_INPUT`
- `409 CONFLICT`

### POST /auth/login

Purpose:
- Authenticate a user and issue a short-lived access token plus refresh token.

Request JSON:

```json
{
  "identifier": "user_1",
  "password": "demo-pass-123"
}
```

Success response (200):

```json
{
  "userId": "user_1",
  "displayName": "User One",
  "accessToken": "<jwt-access-token>",
  "refreshToken": "<jwt-refresh-token>",
  "expiresIn": 1200
}
```

Common errors:
- `401 AUTH_FAILED`
- `400 INVALID_INPUT`

### POST /auth/refresh

Purpose:
- Exchange a refresh token for a new access token and optionally a new refresh token.

Request JSON:

```json
{
  "refreshToken": "<jwt-refresh-token>"
}
```

Success response (200):

```json
{
  "userId": "user_1",
  "displayName": "User One",
  "accessToken": "<new-jwt-access-token>",
  "refreshToken": "<new-jwt-refresh-token>",
  "expiresIn": 1200
}
```

Common errors:
- `401 AUTH_EXPIRED`
- `401 AUTH_FAILED`

## 2. Document Contracts

### GET /documents

Purpose:
- Return dashboard data for owned and shared documents.

Success response (200):

```json
{
  "owned": [
    {
      "documentId": "doc_123",
      "title": "Project brief",
      "role": "owner",
      "updatedAt": "2026-04-05T12:00:00.000Z",
      "ownerDisplayName": "User One"
    }
  ],
  "shared": [
    {
      "documentId": "doc_456",
      "title": "Meeting notes",
      "role": "editor",
      "updatedAt": "2026-04-05T13:00:00.000Z",
      "ownerDisplayName": "User Two"
    }
  ]
}
```

### POST /documents

Request JSON:

```json
{
  "title": "Untitled document",
  "content": ""
}
```

Success response (201):

```json
{
  "documentId": "doc_123",
  "title": "Untitled document",
  "ownerId": "user_1",
  "createdAt": "2026-04-05T12:00:00.000Z",
  "updatedAt": "2026-04-05T12:00:00.000Z",
  "currentVersionId": "ver_1"
}
```

### GET /documents/:documentId

Success response (200):

```json
{
  "documentId": "doc_123",
  "title": "Project brief",
  "content": "Latest saved content",
  "updatedAt": "2026-04-05T12:20:00.000Z",
  "currentVersionId": "ver_4",
  "role": "editor",
  "revisionId": "rev_4"
}
```

### PUT /documents/:documentId/content

Request JSON:

```json
{
  "requestId": "req_save_001",
  "content": "Updated document content",
  "baseRevisionId": "rev_4"
}
```

Success response (200):

```json
{
  "documentId": "doc_123",
  "updatedAt": "2026-04-05T12:21:00.000Z",
  "revisionId": "rev_5"
}
```

## 3. Realtime Session Contract

### POST /sessions

Purpose:
- Create an authenticated collaboration session for the realtime service.

Request JSON:

```json
{
  "documentId": "doc_123"
}
```

Success response (200):

```json
{
  "sessionId": "sess_123",
  "wsUrl": "ws://localhost:3001/ws?token=<signed-session-token>",
  "role": "editor"
}
```

### WebSocket auth model

- REST APIs use JWT bearer tokens.
- The frontend uses JWT auth to call `POST /sessions`.
- The backend validates the JWT and document permission before issuing the realtime session.
- The returned `wsUrl` contains a short-lived signed session token.
- The realtime service validates that session token and re-checks document role before allowing the session.

## 4. AI Streaming Contract

### POST /ai/rewrite/stream

Purpose:
- Start a streaming rewrite request for selected text.

Request JSON:

```json
{
  "documentId": "doc_123",
  "selection": { "start": 0, "end": 42 },
  "selectedText": "Original selected text",
  "contextBefore": "",
  "contextAfter": "remaining content",
  "instruction": "Make this more concise",
  "baseVersionId": "ver_4"
}
```

Streaming response event model (SSE-style conceptual shape):

```text
event: token
data: {"text":"Some"}

event: token
data: {"text":" streamed"}

event: done
data: {"jobId":"aijob_123","fullText":"Some streamed result"}
```

Error event:

```text
event: error
data: {"code":"AI_FAILED","message":"Provider request failed"}
```

### Cancel contract

Option A:
- client closes the stream connection

Option B:
- separate cancel endpoint:

```json
POST /ai/jobs/:jobId/cancel
```

## 5. AI History Contract

### GET /documents/:documentId/ai-history

Success response (200):

```json
[
  {
    "id": "aih_123",
    "documentId": "doc_123",
    "action": "rewrite",
    "promptLabel": "Make this more concise",
    "outputPreview": "Shortened version of the text",
    "status": "accepted",
    "createdAt": "2026-04-05T12:25:00.000Z",
    "jobId": "aijob_123"
  }
]
```

## 6. Standard Error Schema

All non-2xx responses should follow:

```json
{
  "error": {
    "code": "<CODE>",
    "message": "<MESSAGE>",
    "details": {}
  }
}
```
