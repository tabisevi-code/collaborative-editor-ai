# FastAPI Backend (Assignment 2 Work-in-Progress)

This directory is the Assignment 2 backend migration target.

Goals for this service:

- registration and login with hashed passwords
- JWT access and refresh token lifecycle
- protected document routes
- FastAPI auto-generated docs
- a clean bridge from the current MVP contracts toward Assignment 2 requirements

Current backend foundation slice includes:

- persistent users in SQLite
- hashed passwords
- JWT access and refresh token issuance
- protected dashboard/document routes
- version history, revert, permissions, and session issuance routes
- FastAPI auto-generated docs at `/docs`

Realtime authentication model for Assignment 2 foundation:

1. the client authenticates against FastAPI using JWT bearer tokens
2. the frontend calls `POST /sessions` with the bearer token
3. the backend validates document access and issues a short-lived signed session token
4. the realtime service validates that signed token and enforces the current document role for websocket activity

AI note:

- AI streaming and AI history routes are intentionally scaffolded but left unimplemented in this backend slice
- those routes are reserved for the dedicated AI workstream so they can be committed separately by the AI owner

Run locally (once dependencies are installed):

```bash
cd backend_fastapi
uvicorn app.main:app --reload --port 8000
```
