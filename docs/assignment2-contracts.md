# Assignment 2 Contracts

This file reflects the final implemented Assignment 2 contracts.

## Auth

### `POST /auth/register`

Request:

```json
{
  "identifier": "user_1",
  "displayName": "User One",
  "password": "demo-pass-123"
}
```

Response: `201`

```json
{
  "userId": "user_1",
  "displayName": "User One",
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 1200
}
```

### `POST /auth/login`

Request:

```json
{
  "identifier": "user_1",
  "password": "demo-pass-123"
}
```

Response: `200`, same shape as register.

### `POST /auth/refresh`

Request:

```json
{
  "refreshToken": "<jwt>"
}
```

Response: `200`, same shape as login.

### `GET /auth/me`

Response:

```json
{
  "userId": "user_1",
  "displayName": "User One"
}
```

### `POST /auth/logout`

Request:

```json
{
  "refreshToken": "<jwt>"
}
```

Response:

```json
{
  "revoked": true
}
```

### `POST /auth/forgot-password`

Request:

```json
{
  "identifier": "user_1"
}
```

Response:

```json
{
  "accepted": true,
  "message": "If the account exists, a one-time reset token has been issued for this local environment.",
  "resetToken": "opaque_local_reset_token",
  "expiresAt": "2026-04-30T12:15:00.000Z"
}
```

### `POST /auth/reset-password`

Request:

```json
{
  "identifier": "user_1",
  "resetToken": "opaque_local_reset_token",
  "newPassword": "new-pass-123"
}
```

Response:

```json
{
  "reset": true
}
```

## Documents

### `GET /documents`

Response:

```json
{
  "owned": [],
  "shared": []
}
```

### `POST /documents`

Response: `201`

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

### `GET /documents/:documentId`

```json
{
  "documentId": "doc_123",
  "title": "Project brief",
  "content": "<p>Latest saved content</p>",
  "updatedAt": "2026-04-05T12:20:00.000Z",
  "currentVersionId": "ver_4",
  "role": "editor",
  "revisionId": "rev_4"
}
```

### `PUT /documents/:documentId/content`

```json
{
  "requestId": "req_save_001",
  "content": "<p>Updated document content</p>",
  "baseRevisionId": "rev_4",
  "updateReason": "content_update"
}
```

This route is idempotent per authenticated user and `requestId`. Repeating the same request with the same `requestId` returns the original response instead of creating a second save version.

## Realtime

### `POST /sessions`

```json
{
  "documentId": "doc_123"
}
```

```json
{
  "sessionId": "sess_123",
  "wsUrl": "ws://localhost:3001/ws",
  "sessionToken": "<signed-session-token>",
  "role": "editor"
}
```

The frontend opens the websocket using the signed `sessionToken` as a WebSocket subprotocol, not as a query-string token.

Access tokens are tied to the active refresh-token session, so a refresh invalidates older access-token sessions immediately.

## Share Links

### `POST /documents/:documentId/share-links`

```json
{
  "role": "editor",
  "expiresInHours": 168,
  "requestId": "req_share_001"
}
```

```json
{
  "linkId": "link_123",
  "role": "editor",
  "createdAt": "2026-04-05T12:00:00.000Z",
  "expiresAt": "2026-04-12T12:00:00.000Z",
  "revokedAt": null,
  "lastClaimedAt": null,
  "active": true,
  "shareToken": "opaque_share_token"
}
```

### `GET /documents/:documentId/share-links`

```json
{
  "documentId": "doc_123",
  "links": [
    {
      "linkId": "link_123",
      "role": "editor",
      "createdAt": "2026-04-05T12:00:00.000Z",
      "expiresAt": "2026-04-12T12:00:00.000Z",
      "revokedAt": null,
      "lastClaimedAt": null,
      "active": true
    }
  ]
}
```

### `GET /share-links/:token`

```json
{
  "documentId": "doc_123",
  "documentTitle": "Project brief",
  "role": "editor",
  "expiresAt": "2026-04-12T12:00:00.000Z",
  "ownerDisplayName": "User One"
}
```

### `POST /share-links/:token/accept`

```json
{
  "documentId": "doc_123",
  "role": "editor",
  "accepted": true
}
```

### `DELETE /documents/:documentId/share-links/:linkId?revokeAccess=true`

```json
{
  "linkId": "link_123",
  "role": "editor",
  "createdAt": "2026-04-05T12:00:00.000Z",
  "expiresAt": "2026-04-12T12:00:00.000Z",
  "revokedAt": "2026-04-06T08:00:00.000Z",
  "lastClaimedAt": "2026-04-05T12:30:00.000Z",
  "active": false,
  "revokedAccessCount": 1
}
```

## AI Streaming

### `POST /ai/rewrite/stream`

### `POST /ai/summarize/stream`

### `POST /ai/translate/stream`

All three endpoints return `text/event-stream` responses.

Event format:

```text
event: token
data: {"jobId":"aijob_123","text":"Some"}

event: done
data: {"jobId":"aijob_123","fullText":"Some streamed result"}
```

Error event:

```text
event: error
data: {"jobId":"aijob_123","code":"AI_FAILED","message":"Provider request failed"}
```

### `POST /ai/jobs/:jobId/cancel`

```json
{
  "jobId": "aijob_123",
  "cancelled": true
}
```

### `POST /ai/jobs/:jobId/feedback`

```json
{
  "disposition": "applied_full",
  "appliedText": "Edited output",
  "appliedRange": { "start": 0, "end": 12 }
}
```

Client-side apply rule:

- AI results are applied only if the current text inside the target range still matches the source text that the suggestion was generated from.
- If another collaborator changed that source text first, the apply is blocked and the user must re-run AI on the latest text.

## AI History

### `GET /documents/:documentId/ai-history`

```json
[
  {
    "id": "aih_123",
    "documentId": "doc_123",
    "action": "rewrite",
    "promptLabel": "Make this more concise",
    "outputPreview": "Shortened version",
    "status": "accepted",
    "createdAt": "2026-04-05T12:25:00.000Z",
    "jobId": "aijob_123"
  }
]
```

### `GET /documents/:documentId/ai-usage`

```json
{
  "documentId": "doc_123",
  "aiEnabled": true,
  "dailyQuota": 5,
  "usedToday": 1,
  "remainingToday": 4,
  "allowedRolesForAI": ["owner", "editor"],
  "currentUserRole": "editor",
  "canUseAi": true
}
```

## Standard Error Schema

All non-2xx responses use:

```json
{
  "error": {
    "code": "<CODE>",
    "message": "<MESSAGE>",
    "details": {}
  }
}
```
