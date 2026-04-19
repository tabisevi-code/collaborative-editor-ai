# Demo Runbook

This file now assumes you are starting the stack yourself in whatever way you prefer.

Use this as a manual walkthrough once the site is already running.

## Assumed Running Services

The walkthrough assumes these URLs are available:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Realtime: `ws://localhost:3001/ws`

## Quick Evaluator Flow

If you want the fastest manual walkthrough:

1. Open `http://localhost:5173`
2. Register or sign in as `user_1`
3. Create a document
4. Open the same document in another tab/window as `user_2`
5. Grant `editor` access from `user_1`
6. Verify live sync in both directions
7. Pause typing to verify autosave
8. Create an editor share link and accept it in another browser
9. Show inline remote cursor or selection rendering
10. Run AI rewrite or summarize and show streaming/cancel
11. Open AI history
12. Open version history and revert
13. Export the document as PDF or DOCX
14. Open `http://localhost:8000/docs/`

## Demo Flow

1. Open the frontend in two browser windows.
2. In window A, register or sign in as `user_1` using the login page.
3. Create a new document.
4. Copy the document URL from window A into window B.
5. In window B, register or sign in as `user_2` using the login page and open the same document URL.
6. Before sharing, note that `user_2` should not have editor access yet.
7. In window A, open permissions and grant `editor` access to `user_2`.
8. Type in window A and confirm text appears in window B.
9. Type in window B and confirm text appears in window A.
10. Pause briefly and point out autosave changing the header state back to "All changes saved".
11. Point out the live collaborator presence chips.
12. Create a share link and open it in another browser to demonstrate share-by-link acceptance.
13. Select text in one browser and show inline remote cursor/selection rendering in the other browser.
14. Trigger an AI action from selected text, demonstrate streaming output, optionally cancel once, then review and apply either the full suggestion or only the highlighted part of the AI output.
15. Open version history and show the extra AI-related snapshots.
16. Revert to an earlier version while both collaborators are not actively typing.
17. Confirm both windows update after the revert.
18. Switch `user_2` to `viewer` once and confirm viewer mode blocks edits but still receives updates.
19. Open AI history and show accepted/rejected entries.
20. Export as PDF and show that the download is a real file.
21. Export as DOCX and confirm the file downloads successfully.
22. Open Swagger/OpenAPI at `http://localhost:8000/docs/`.

## Notes

- If realtime disconnects during a demo, refresh the document page. The current content is still persisted in SQLite.
- If LM Studio is unavailable, the deterministic stub provider is still acceptable for evaluation because it exercises the same backend-streaming AI workflow end-to-end.
- If you want a fuller QA pass instead of a quick walkthrough, use `docs/manual-testing-checklist.md`.
