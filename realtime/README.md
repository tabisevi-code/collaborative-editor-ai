# Real-Time Service

This service hosts the WebSocket layer for collaborative editing.

Professors and evaluators usually do not need to interact with this service directly. The easiest path is to start the full stack from the repo root and exercise collaboration through the frontend.

For repo-wide install, dev, and test commands, start from the root README:

```bash
npm run install:all
npm run dev:all
npm run test:all
```

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
npm test
```

Environment variables:

- `REALTIME_PORT` default `3001`
- `DATABASE_PATH` default `../backend/data/collaborative-editor-ai.sqlite`
- `REALTIME_SHARED_SECRET` must match the backend value
