# Manual Testing Checklist

This checklist is for a full manual QA pass after the stack is already running.

Recommended setup:

- Browser A signed in as `user_1`
- Browser B signed in as `user_2`
- Optional Browser C for share-link tests
- Frontend at `http://localhost:5173`
- Backend docs at `http://localhost:8000/docs`

## Automated Preflight

- [ ] Run `npm run test:all`
- [ ] Run `cd frontend && AI_STREAM_PROVIDER=stub npm run test:e2e`
- [ ] Optional: run `cd frontend && AI_STREAM_PROVIDER=lmstudio npm run test:e2e`

## Auth

- [ ] Register a brand new user
- [ ] Log out and log back in with that user
- [ ] Confirm wrong-password login is rejected
- [ ] Confirm duplicate registration is rejected
- [ ] Refresh the page and confirm the session restores
- [ ] Leave the app open long enough to confirm the session stays usable
- [ ] Log out and confirm protected routes redirect back to login

## Dashboard

- [ ] Dashboard loads owned and shared sections
- [ ] Create a document from the dashboard
- [ ] Search by title and confirm filtering works
- [ ] Change sort order and confirm results update
- [ ] Confirm empty states make sense when there are no matches

## Document Loading

- [ ] Open a document directly by URL
- [ ] Confirm title, content, role, and metadata load correctly
- [ ] Refresh the document page and confirm content persists

## Rich Text Editor

- [ ] Type plain text
- [ ] Apply bold
- [ ] Apply italic
- [ ] Apply underline
- [ ] Apply strike-through
- [ ] Apply bullet list
- [ ] Apply numbered list
- [ ] Apply heading 1
- [ ] Apply heading 2
- [ ] Apply heading 3
- [ ] Apply code block
- [ ] Use undo and redo
- [ ] Confirm formatting persists after reload

## Autosave

- [ ] Edit content and watch save status move into saving then back to saved
- [ ] Pause typing and confirm autosave persists the current text
- [ ] Refresh and confirm the saved content returns

## Collaboration

- [ ] Open the same document in Browser A and Browser B
- [ ] Type in Browser A and confirm Browser B updates live
- [ ] Type in Browser B and confirm Browser A updates live
- [ ] Confirm collaborator chips appear
- [ ] Select text in Browser A and confirm Browser B shows inline remote selection/cursor
- [ ] Confirm reconnect behavior is acceptable after refreshing one browser

## Permissions

- [ ] Owner grants `editor` to another user
- [ ] Owner grants `viewer` to another user
- [ ] Viewer can read but cannot edit
- [ ] Owner removes access from another user
- [ ] Removed user loses access on refresh or live update path

## Share Links

- [ ] Owner creates a viewer share link
- [ ] Open the link signed out and confirm preview page appears
- [ ] Follow the link into login and confirm `next` returns to share acceptance
- [ ] Accept the link and confirm the document opens
- [ ] Repeat with an editor share link
- [ ] Revoke a share link
- [ ] Confirm the revoked link no longer previews/accepts
- [ ] Revoke a share link with the "revoke granted access" toggle enabled
- [ ] Confirm link-granted access is removed when expected

## AI Policy And Quota

- [ ] Open AI policy panel as owner
- [ ] Disable AI and confirm usage is blocked
- [ ] Re-enable AI and confirm it becomes available again
- [ ] Change allowed roles and confirm blocked roles cannot run AI
- [ ] Confirm daily quota, used today, and remaining today are displayed

## AI Actions

- [ ] Select text and run rewrite
- [ ] Select text and run summarize
- [ ] Select text and run translate
- [ ] Confirm streaming output appears incrementally
- [ ] Cancel a stream and confirm cancellation is shown
- [ ] Run a completed AI action and apply the full result
- [ ] Run another AI action and apply only a selection
- [ ] Reject an AI result

## AI History

- [ ] Open AI history and confirm entries appear
- [ ] Confirm accepted, edited, rejected, and cancelled statuses are visible over time
- [ ] Refresh the page and confirm AI history persists

## Version History And Revert

- [ ] Open version history
- [ ] Confirm multiple versions exist after edits/AI actions
- [ ] Click between versions and inspect preview content
- [ ] Revert to an earlier version
- [ ] Confirm document content updates after revert
- [ ] Confirm collaborators also see the reverted content

## Exports

- [ ] Export TXT
- [ ] Export JSON
- [ ] Export PDF and confirm the file downloads successfully
- [ ] Open the PDF and confirm it contains the document title/content
- [ ] Export DOCX and confirm the file downloads successfully
- [ ] Open the DOCX and confirm it contains the document title/content

## Negative And Security-Oriented Checks

- [ ] Confirm `/docs` is available and reflects the implemented routes
- [ ] Confirm protected API calls fail without auth
- [ ] Confirm an old access token stops working after refresh/logout
- [ ] Confirm a revoked share link cannot be reused
- [ ] Confirm viewer role cannot write through the UI
- [ ] Confirm stale/repeated save actions do not duplicate extra versions unexpectedly

## Submission Confidence Check

- [ ] Walk through the quick evaluator flow in `DEMO.md`
- [ ] Confirm the current behavior matches `docs/assignment2-contracts.md`
- [ ] Confirm the current behavior matches `docs/assignment2-current-state.md`
- [ ] Confirm `README.md` startup/testing notes still match reality
