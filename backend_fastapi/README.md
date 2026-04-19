# FastAPI Backend

This is the Assignment 2 primary backend.

It provides:

- register, login, refresh, logout, and `/auth/me`
- protected document CRUD, permissions, share-links, versions, revert, and sessions
- backend-streamed AI rewrite/summarize/translate
- AI history, AI policy, AI usage, and export routes
- real PDF/DOCX export generation plus async export job handling
- idempotent save, share-link creation, and revert routes
- FastAPI OpenAPI docs at `/docs`

## Local Run

```bash
python3 -m pip install -e .
python3 -m uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
python3 -m pytest -q
```

## Environment

Copy `backend_fastapi/.env.example` to `backend_fastapi/.env` if you want local overrides.

Important variables:

- `FASTAPI_DATABASE_URL`
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `REALTIME_WS_BASE_URL`
- `REALTIME_SHARED_SECRET`
- `AI_STREAM_PROVIDER`
- `AI_PROVIDER_ENDPOINT`
- `AI_MODEL`

## Realtime Contract

1. The frontend authenticates against FastAPI using JWT bearer tokens.
2. The frontend calls `POST /sessions`.
3. FastAPI validates document access and returns a signed short-lived websocket session token plus the base websocket URL.
4. The frontend sends that signed token during the WebSocket subprotocol handshake.
5. The realtime service verifies the token and re-checks the document role from the shared SQLite database.

## Security Notes

- passwords are hashed with `pbkdf2_sha256`
- refresh tokens are hashed before database storage
- access tokens are tied to the active refresh-token session, so refresh invalidates older access-token sessions immediately
- auth and session issue routes are rate limited through the shared SQLite database instead of process-local memory
