# Real-Time Service

This service hosts the WebSocket layer for collaborative editing.

Responsibilities:

- Validate session tokens issued by the backend
- Broadcast join/leave/presence updates
- Relay edit operations for authorised collaborators
- Reject write attempts from viewers
- React to backend-generated SQLite events such as permission revocation and document revert

## Run

```bash
cd realtime
npm install
npm run dev
```

Environment variables:

- `REALTIME_PORT` default `3001`
- `DATABASE_PATH` default `../backend/data/collaborative-editor-ai.sqlite`
- `REALTIME_SHARED_SECRET` must match the backend value
