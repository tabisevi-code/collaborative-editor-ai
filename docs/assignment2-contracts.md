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

## AI Routes On This Core Branch

The FastAPI AI routes are intentionally present only as reserved placeholders on this core branch.

- `POST /ai/rewrite/stream`
- `POST /ai/summarize/stream`
- `POST /ai/translate/stream`
- `GET /ai/history/:documentId`

Current behavior:

- these routes return `501 NOT_IMPLEMENTED`
- the dedicated AI workstream is intentionally left for a separate follow-up branch/PR

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
