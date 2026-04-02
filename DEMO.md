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

## Professor Quick Check

If an evaluator wants the fastest path to confirm the full system:

1. Run `npm run demo:reset`
2. Open `http://localhost:5173`
3. Sign in as `user_1`
4. Create a document
5. Open the same document in another tab as `user_2`
6. Grant `editor` access from `user_1`
7. Verify live sync in both directions
8. Pause typing to verify autosave
9. Run AI rewrite or summarize
10. Open version history and revert
11. Export the document
12. Open `http://localhost:3000/docs/`

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Realtime: `ws://localhost:3001/ws`

## Demo Flow

1. Open the frontend in two browser windows.
2. In window A, sign in as `user_1` using the login page.
3. Create a new document.
4. Copy the document URL from window A into window B.
5. In window B, sign in as `user_2` using the login page and open the same document URL.
6. Before sharing, note that `user_2` should not have editor access yet.
7. In window A, open permissions and grant `editor` access to `user_2`.
8. Type in window A and confirm text appears in window B.
9. Type in window B and confirm text appears in window A.
10. Pause briefly and point out autosave changing the header state back to "All changes saved".
11. Point out the live collaborator presence chips.
12. Trigger an AI action from selected text, wait for the job to finish, then review and apply either the full suggestion or only the highlighted part of the AI output.
13. Open version history and show the extra AI-related snapshots.
14. Revert to an earlier version while both collaborators are not actively typing.
15. Confirm both windows update after the revert.
16. Switch `user_2` to `viewer` once and confirm viewer mode blocks edits but still receives updates.
17. Open Swagger/OpenAPI at `http://localhost:3000/docs/`.

## Fallback Notes

- If you want to force a specific provider instead of auto-detecting it, run:

```bash
AI_PROVIDER=lmstudio npm run demo:reset
```

- If realtime disconnects during a demo, refresh the document page. The current content is still persisted in SQLite.
- If you want a containerized demo instead, use `docker compose up --build` from the repo root. On macOS without Docker Desktop, start Colima first with `colima start`.
- If LM Studio is unavailable, the deterministic stub provider is still acceptable for evaluation because it exercises the same async AI workflow end-to-end.
