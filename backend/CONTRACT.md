# Backend Contract Notes

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
