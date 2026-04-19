> Historical architecture decision record from earlier design stages.
> Not authoritative for the final Assignment 2 submission. See `docs/assignment2-contracts.md` for the current delivered API behavior.

ADR-002: API style and long-running operations (async jobs)
- Status: Accepted (if team agrees)
- Context:
  - The system requires document CRUD, permissions, versioning, AI operations, and exports.
  - AI rewrite/export can take seconds to minutes and cannot block the UI or request threads.
- Decision:
  - Use REST APIs for document/permission/version CRUD.
  - Use a push channel (WebSocket) for real-time collaboration events (ops, presence, revert events).
  - Model AI and export as asynchronous jobs:
    - POST creates a job and returns {jobId, statusUrl}
    - GET status endpoint returns PENDING/RUNNING/SUCCEEDED/FAILED with result when ready
- Rationale:
  - REST is simple, testable, and aligns with the PoC requirement (POST /documents, GET /documents/:id).
  - Async jobs provide predictable UX and clear error handling for long-running tasks.
- Consequences:
  - Pros:
    - Clear separation between real-time and CRUD concerns.
    - Robust handling of slow AI provider and export tasks.
  - Cons:
    - Requires job persistence and status polling (or optional push notifications).
- Alternatives considered:
  - Polling for real-time collaboration: higher latency and wasteful.
  - Synchronous AI calls: poor UX, timeouts likely, hard to scale.
  - GraphQL for everything: more complex than needed for the project.
