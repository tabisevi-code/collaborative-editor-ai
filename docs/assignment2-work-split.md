# Assignment 2 Work Split

> Historical planning artifact from the earlier team split.
> The final implementation is now best understood through `docs/assignment2-current-state.md` and `docs/assignment2-contracts.md`.

This document splits Assignment 2 into four ownership areas so the implementation can move fast while
keeping GitHub contribution history clean and reviewable.

The split is based on the Assignment 2 brief and the current repository state.

## Overall Strategy

Assignment 2 introduces three hard shifts relative to the current MVP:

1. A FastAPI backend is expected.
2. JWT auth with registration, hashed passwords, and refresh tokens is required.
3. AI responses must stream token-by-token.

To keep ownership clear, we should avoid everyone touching the same files at once.

## Ownership Overview

| Person | Primary Ownership | Main Deliverables |
|---|---|---|
| Tabina | Architecture, infrastructure, integration management | branch strategy, repo structure, run scripts, env docs, deviations report, Docker/CI updates, final consistency |
| Noel | Backend + auth + contracts | FastAPI app, JWT auth, protected REST routes, websocket auth, persistence, API docs |
| Nurtore | AI + data model | streaming AI service, provider abstraction, prompt/config modules, AI history, data model updates |
| Ming Ming | Frontend + UX | login/register UI, dashboard, rich-text editor, auth refresh handling, AI streaming UI, collaboration UX |

## Branch Naming

Use one major branch per owner plus optional sub-branches when needed:

- `a2/tabina-infra`
- `a2/noel-backend`
- `a2/nurtore-ai`
- `a2/mingming-frontend`

If a feature is large, use a sub-branch from the owner branch:

- `a2/noel-auth-jwt`
- `a2/noel-fastapi-docs`
- `a2/nurtore-ai-streaming`
- `a2/mingming-richtext-editor`

## Work Split by Person

### 1. Tabina — Architecture, Infra, Integration

Tabina should own everything that improves evaluator experience and keeps the whole repo runnable.

#### Must own

- Create `DEVIATIONS.md`
- Create/update root `Makefile` or `run.sh`
- Create root `.env.example`
- Keep `README.md` aligned with Assignment 2
- Keep diagrams and diagram sources aligned
- Keep `final-report/` or Assignment 2 report package aligned
- Update Docker/Colima instructions if needed
- Update CI to match the new Assignment 2 stack
- Maintain the work split / milestone board

#### Best files for Tabina

- `README.md`
- `DEVIATIONS.md`
- `.env.example`
- `Makefile` or `run.sh`
- `.github/workflows/*`
- `docs/**`
- `final-report/**`
- `docker-compose.yml`

#### Good visible GitHub contributions

- repo orchestration
- report updates
- diagram source updates
- CI fixes
- deviations documentation

#### Avoid owning

- deep FastAPI route logic
- AI streaming endpoint internals
- editor internals

### 2. Noel — Backend, Auth, API Contracts

Noel should own the backend migration and all security-critical server behavior.

#### Must own

- FastAPI backend structure
- JWT auth lifecycle
  - register
  - login
  - refresh
  - logout/revoke if implemented
- password hashing
- protected document CRUD routes
- permissions enforcement server-side
- websocket/session auth design on server side
- versioning and revert persistence logic
- FastAPI auto-generated docs
- backend tests with `pytest`

#### Best files for Noel

- `backend_fastapi/` or replacement backend package
- `backend/**` if migrating in-place
- auth modules
- models/schemas
- route definitions
- repository/persistence modules
- backend test files

#### Specific Assignment 2 tasks

- implement `POST /auth/register`
- implement `POST /auth/login`
- implement `POST /auth/refresh`
- issue access tokens + refresh tokens
- hash passwords securely
- require auth on all protected endpoints
- explain websocket auth path in docs
- expose FastAPI `/docs`

#### Good visible GitHub contributions

- backend commit history should clearly show auth, routes, persistence, tests

#### Avoid owning

- frontend rich-text editor implementation
- AI prompt UX details

### 3. Nurtore — AI, Streaming, Data Model

Nurtore should own the AI-specific part of Assignment 2, because this is where the biggest delta from the
current MVP exists.

#### Must own

- AI streaming design and implementation
- provider abstraction cleanup
- prompt modules / prompt templates
- scoped context logic
- AI cancellation behavior
- AI failure handling
- AI history model and API
- data-model updates required for auth + AI
- AI-related tests

#### Best files for Nurtore

- `ai-service/**`
- AI-specific backend modules/routes/schemas
- provider interfaces
- prompt/config files
- AI history UI contract docs
- data model docs and ER diagram updates

#### Specific Assignment 2 tasks

- convert AI from polling-only to streaming responses
- support token-by-token streaming to frontend
- add cancel capability
- preserve partial output or discard cleanly
- add AI interaction history API
- record prompt, model, response, accepted/rejected status

#### Good visible GitHub contributions

- AI streaming endpoint commits
- provider refactors
- prompt modules
- AI history schema and tests

#### Avoid owning

- general frontend dashboard layout
- backend auth core

### 4. Ming Ming — Frontend, Rich Editor, User Flows

Ming Ming should own the user-facing Assignment 2 delta.

#### Must own

- login UI
- registration UI
- session persistence and refresh handling
- document dashboard/listing
- rich-text editor integration
- autosave status UX
- AI streaming display UI
- AI accept/reject/edit UX
- AI history UI
- collaboration UX polish

#### Best files for Ming Ming

- `frontend/src/pages/**`
- `frontend/src/components/**`
- `frontend/src/hooks/**`
- editor integration files
- frontend tests

#### Specific Assignment 2 tasks

- add register/login pages
- add session refresh behavior in frontend
- add dashboard listing owned/shared docs
- replace lightweight editor with a proper rich-text editor
- add streaming AI rendering and cancel button
- add AI history panel

#### Good visible GitHub contributions

- rich-text editor commits
- dashboard commits
- auth UI commits
- AI streaming UI commits

#### Avoid owning

- backend JWT issuance logic
- database migrations and persistence internals

## Shared Integration Boundaries

To avoid stepping on each other, agree on these boundaries first:

### Auth contract

Noel defines:

- register request/response
- login request/response
- refresh request/response
- token expiry and refresh behavior

Ming Ming consumes those contracts in the frontend.

### AI streaming contract

Nurtore + Noel define:

- endpoint path
- event format or streamed chunks
- cancel mechanism
- error semantics

Ming Ming consumes this in the frontend.

### Data model

Noel + Nurtore must align on:

- users
- credentials/password hashing storage
- documents
- versions
- permissions
- AI interactions/history

### Realtime auth

Noel defines:

- how websocket or session auth is validated
- how roles are enforced in realtime

Ming Ming only integrates that from the client side.

## Recommended Milestone Order

### Milestone 1 — Backend/auth foundation

Owner-heavy:

- Noel: FastAPI base + JWT auth
- Tabina: `DEVIATIONS.md`, root scripts, env docs

### Milestone 2 — Frontend auth + dashboard

- Ming Ming: register/login flow, dashboard
- Noel: backend list-documents endpoint

### Milestone 3 — Rich editor + save/version flow

- Ming Ming: rich-text editor
- Noel: save/version contracts

### Milestone 4 — AI streaming

- Nurtore: streaming AI backend + provider flow
- Ming Ming: streaming AI UI + cancel

### Milestone 5 — Final hardening

- Tabina: docs, report, diagrams, CI, run scripts
- everyone: tests and demo polish

## What Each Person Should Avoid Changing Without Coordination

### Nobody should silently change

- API JSON contracts
- auth token shape/lifecycle
- websocket auth/session format
- AI streaming payload shape
- database schema names

These should be discussed first, then changed once.

## Minimum Contribution Evidence Plan

To make GitHub contribution evidence obvious:

- each person should create at least 3-5 meaningful commits in their ownership area
- each person should open at least one PR or feature branch merge
- avoid one giant final merge commit
- keep commit messages scoped and meaningful
- avoid squashing all history into one commit if you want contribution evidence to remain visible

Examples:

- `feat(auth): add FastAPI register and login routes`
- `feat(frontend): add dashboard for owned and shared documents`
- `feat(ai): stream rewrite suggestions over SSE`
- `docs(report): add assignment2 deviation section`

## What Evaluators Can Check on GitHub

Professors or TAs can inspect all of the following directly from GitHub:

### Commit-level evidence

- who authored commits
- how many commits each contributor made
- whether commit messages are meaningful or vague
- whether work is split across multiple days or dumped in one final push
- whether a person's commits clearly align with their claimed ownership area

### Branch / PR evidence

- whether feature branches exist
- whether work was merged through PRs instead of directly into main
- whether PR descriptions explain the feature
- whether review comments or approvals exist

### File-level evidence

- which files each person changed
- whether a contributor touched only docs or also actual code
- whether backend/auth/AI/frontend ownership claims are believable from the diff history

### Repository quality evidence

- whether main is runnable
- whether the README setup actually works
- whether tests run from the documented command
- whether `DEVIATIONS.md` exists and is honest
- whether diagrams have editable source files

### Team-collaboration evidence

- multiple contributors with visible commit history
- issue references in commits/PRs if used
- coherent progression from baseline to final implementation

## Important Rule About Contributions

If Nurtore needs visible contribution evidence for Assignment 2, that must come from real commits on the
AI/data-model work. Do not try to manufacture contribution evidence retroactively in a misleading way.

The right approach is:

- Nurtore owns and commits AI streaming implementation
- Nurtore owns and commits AI history/data-model changes
- Nurtore updates AI-related report sections and diagram sources where relevant

That way the repository evidence honestly matches the ownership claims.

## Assignment 2 Submission Checklist

The final Assignment 2 submission should include, at minimum:

### In the repository

- React frontend
- FastAPI backend
- JWT auth with register/login/refresh
- authenticated WebSocket or session-based realtime join path
- streaming AI implementation
- server-side permission enforcement
- README with setup and run instructions
- root `.env.example`
- `run.sh` or `Makefile` for one-command startup
- FastAPI auto-generated docs
- `DEVIATIONS.md`
- tests for backend, frontend, and websocket/auth behavior

### In Git/GitHub history

- visible contributions from all four members
- meaningful commit messages
- feature branches / PR evidence if possible

### In the final demo

- registration/login
- protected routes
- document creation + rich-text editing + autosave
- sharing + role enforcement
- realtime collaboration in two windows
- AI streaming with cancellation
- suggestion accept/reject/edit flow
- version history restore

## Assignment 2 Minimum Path vs High-Grade Path

### Minimum convincing path

- FastAPI backend migration
- JWT auth with hashed passwords and refresh tokens
- streaming AI
- `DEVIATIONS.md`
- root run command and `.env.example`
- main branch contains final version

### High-grade path

- all minimum items above
- dashboard for owned/shared documents
- proper rich-text editor
- AI history UI
- remote cursor rendering
- E2E tests

## Final Advice

For Assignment 2, do not optimize only for “working code.” Optimize for visible, reviewable progress:

- clear branch ownership
- clean commit history
- explicit deviation documentation
- passing repo-wide commands
- each member leaving unmistakable evidence in the area they owned

## Final Advice

If time is limited, prioritize clean ownership over speed. A slightly smaller but clearly divided implementation
is better for grading than messy overlap where no one’s contribution is obvious.
