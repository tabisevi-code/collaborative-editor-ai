# Demo Runbook

This is the safest live-demo path for the current MVP.

## Recommended Demo Reset

From the repo root:

```bash
npm run install:all
npm run demo:reset
```

`demo:reset` does two things:

- removes the local SQLite database used by the backend/realtime pair
- starts backend, realtime, and frontend using the current app build
- auto-selects `AI_PROVIDER=lmstudio` when LM Studio is reachable, otherwise falls back to `AI_PROVIDER=stub`

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Realtime: `ws://localhost:3001/ws`

## Demo Flow

1. Open the frontend in two browser windows.
2. In window A, sign in as `user_1`.
3. Create a new document.
4. In window B, sign in as `user_2` and open the same document URL.
5. In window A, open permissions and grant `editor` access to `user_2`.
6. Type in window A and confirm text appears in window B.
7. Type in window B and confirm text appears in window A.
8. Pause briefly and point out autosave changing the header state back to "All changes saved".
9. Point out the live collaborator presence chips.
10. Trigger an AI action from selected text, wait for the job to finish, then review and apply either the full suggestion or only the highlighted part of the AI output.
11. Open version history and show the extra AI-related snapshots.
12. Revert to an earlier version.
13. Confirm both windows update after the revert.

## Fallback Notes

- If you want to force a specific provider instead of auto-detecting it, run:

```bash
AI_PROVIDER=lmstudio npm run demo:reset
```

- If realtime disconnects during a demo, refresh the document page. The current content is still persisted in SQLite.
- If you want a containerized demo instead, use `docker compose up --build` from the repo root.
