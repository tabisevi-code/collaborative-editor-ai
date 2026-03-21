# Backend PoC Contract Lock (Do Not Change Without Team Agreement)

This file pins the JSON fields for the graded PoC endpoints.

## POST /documents
Request:
{
  "title": "Untitled",
  "content": "Initial text"
}

Response (201):
{
  "documentId": "doc_123",
  "title": "Untitled",
  "ownerId": "user_1",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "currentVersionId": "ver_1"
}

## GET /documents/:id
Response (200):
{
  "documentId": "doc_123",
  "title": "Untitled",
  "content": "Latest text",
  "updatedAt": "ISO-8601",
  "currentVersionId": "ver_1",
  "role": "owner|viewer|editor",
  "revisionId": "rev_1"
}

## Standard Error Schema (all non-2xx)
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "title is required",
    "details": { "field": "title" }
  }
}
