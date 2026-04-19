# Assignment 2 Report Addendum

This addendum captures the late-stage implementation work completed after the core Assignment 2 stack was already in place.

## Security And Auth Hardening

- Added local forgot-password and reset-password flow for manual evaluation without requiring an email service.
- Passwords remain hashed using `pbkdf2_sha256`.
- Refresh tokens are hashed before storage.
- Refresh rotation now invalidates older access-token sessions immediately.
- WebSocket authentication now uses a signed subprotocol token instead of a query-string token.
- Auth and session issuance are rate limited through the shared SQLite database.
- Injection-style auth identifiers are rejected at validation time in addition to using parameterized SQL queries.

## AI Behavior Improvements

- The AI panel is now non-modal and stays open while the user changes selection.
- Added a `Use whole document` action.
- Added dedicated instruction controls for rewrite, summarize, and translate.
- Added visible AI quota usage and policy access for owners.
- Fixed the duplicate/append bug caused by stale range replacement.
- Added a stale-source guard so AI apply is blocked if another collaborator changed that source text first.
- Improved prompt rules to request transformed text only, without labels or commentary.

## Collaboration Correctness And Testing

- Added a dedicated realtime regression for simultaneous typing at the same position.
- Added a dedicated realtime regression for overlapping delete/insert conflicts.
- Added a headless Playwright regression for stale AI apply under collaboration.
- Preserved full monorepo regression coverage across backend, frontend, realtime, and root integration.

## Export And Share Workflow Enhancements

- Real PDF export bytes.
- Real DOCX export bytes.
- Share-by-link with revocation.
- Optional revocation of access originally granted through a share link.

## Defensible Implementation Story

The final system is not only feature-complete for the assignment brief but also explicitly hardened against the most likely demonstration and concurrency failures:

- stale auth sessions after refresh
- insecure WebSocket token transport
- brittle AI apply after concurrent edits
- weak or missing manual password recovery
- insufficiently explicit collaboration conflict testing
