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
