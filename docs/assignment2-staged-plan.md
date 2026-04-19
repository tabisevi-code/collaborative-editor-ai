# Assignment 2 Maximum-Grade Execution Plan

> Historical planning artifact from the earlier multi-person split.
> The final implementation state is now tracked in `docs/assignment2-current-state.md` and `docs/assignment2-contracts.md`.

This document turns the Assignment 2 brief into a staged implementation plan that four people can work on
asynchronously while keeping GitHub contribution evidence clean and easy to evaluate.

The goal is not minimum completion. The goal is a high-grade submission with:

- FastAPI backend
- JWT auth with register/login/refresh
- streaming AI
- dashboard + rich-text editor
- AI history
- strong tests
- explicit deviations documentation
- visible branch/PR evidence for all contributors

## Overall Rule

Work should be split so that each person can progress mostly independently inside their owned area, with
clear integration points and no silent contract changes.

## Branch Plan

Use these long-lived owner branches:

- `a2/tabina-infra`
- `a2/noel-backend`
- `a2/nurtore-ai`
- `a2/mingming-frontend`

And create sub-branches when a chunk is large enough to deserve review on its own.

Examples:

- `a2/noel-auth-jwt`
- `a2/noel-documents-fastapi`
- `a2/nurtore-ai-streaming`
- `a2/nurtore-ai-history`
- `a2/mingming-login-dashboard`
- `a2/mingming-richtext-streaming-ui`
- `a2/tabina-deviations-and-ci`

## Stage Overview

| Stage | Goal | Owners | Output |
|---|---|---|---|
| Stage 0 | Freeze interfaces and create infra/docs base | Tabina + Noel + Nurtore + Ming Ming | branch plan, `DEVIATIONS.md`, root env/run setup, API contract stubs |
| Stage 1 | FastAPI + auth foundation | Noel | register/login/refresh, JWT lifecycle, protected routes, FastAPI docs |
| Stage 2 | Frontend auth + dashboard | Ming Ming | login/register UI, session persistence, dashboard listing owned/shared docs |
| Stage 3 | Rich-text editor + document lifecycle | Ming Ming + Noel | editor integration, CRUD/listing/save/version routes and UI |
| Stage 4 | AI streaming + provider abstraction | Nurtore + Noel | streaming backend, cancel, provider interface, prompt modules |
| Stage 5 | AI suggestion UX + AI history | Ming Ming + Nurtore | streaming UI, accept/reject/edit, history UI + API |
| Stage 6 | Realtime auth/polish + testing hardening | Noel + Ming Ming + Tabina | websocket auth clarity, reconnect polish, tests, docs, CI |
| Stage 7 | Final integration and grading hardening | Everyone | green main, final README, DEVIATIONS, demo script, PR evidence |

---

## Stage 0 — Freeze interfaces and foundation

### Objective
Create the non-negotiable scaffolding so everyone can work in parallel without rewriting each other's work.

### Owners
- Tabina: lead
- Noel: auth/API contract input
- Nurtore: AI contract input
- Ming Ming: frontend contract validation

### Tasks

#### Tabina
- Create `DEVIATIONS.md`
- Create root `.env.example`
- Create root `Makefile` or `run.sh`
- Create/update Assignment 2 roadmap docs
- Update README with Assignment 2 plan and supported commands
- Prepare branch naming and PR rules in writing

#### Noel
- Define FastAPI backend folder structure
- Define auth endpoint contracts
- Define websocket/session auth contract

#### Nurtore
- Define AI streaming contract
- Define prompt/provider interface
- Define AI history contract

#### Ming Ming
- Validate auth, dashboard, and AI streaming contracts from frontend perspective

### Required outputs
- agreed endpoint/interface doc
- agreed auth payloads
- agreed AI streaming payloads
- agreed session/join model

### Suggested commits
- `docs(a2): add assignment2 deviations and execution plan`
- `chore(repo): add assignment2 env example and root run entrypoint`

---

## Stage 1 — FastAPI backend and JWT auth foundation

### Objective
Replace or supersede the Node backend with a FastAPI backend that satisfies Assignment 2 baseline security requirements.

### Primary owner
- Noel

### Async-safe task list

#### Noel must implement
- FastAPI app bootstrap
- user model for auth
- password hashing
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- JWT access tokens
- refresh tokens
- token validation dependency
- protected document routes
- websocket/session auth strategy
- FastAPI `/docs`
- pytest auth tests

### Files Noel should own
- `backend_fastapi/**` or the chosen FastAPI service directory
- auth schemas/models/routes
- security helpers
- persistence adapters
- backend tests under `tests/` or `backend_fastapi/tests/`

### Suggested commits
- `chore(backend): scaffold FastAPI service structure`
- `feat(auth): add user registration with hashed passwords`
- `feat(auth): add JWT login and refresh lifecycle`
- `feat(backend): protect document routes with auth dependency`
- `test(backend): add pytest auth and protected-route coverage`

### Handoff needed before others continue
- exact auth response shapes
- token expiry / refresh behavior
- protected route expectations

---

## Stage 2 — Frontend auth and dashboard

### Objective
Replace the MVP's lightweight login handling with Assignment 2’s visible login/register/session UX and add a document dashboard.

### Primary owner
- Ming Ming

### Async-safe task list

#### Ming Ming must implement
- registration page
- login page
- logout flow
- token persistence across refresh
- silent refresh handling
- protected-route behavior in frontend
- dashboard listing owned/shared documents
- document open from dashboard

### Files Ming Ming should own
- `frontend/src/pages/Login*`
- `frontend/src/pages/Register*`
- `frontend/src/pages/Dashboard*`
- `frontend/src/hooks/useAuth*`
- `frontend/src/services/auth*`
- related frontend tests

### Suggested commits
- `feat(frontend): add register and login pages`
- `feat(frontend): persist jwt session and refresh tokens`
- `feat(frontend): add dashboard for owned and shared documents`
- `test(frontend): cover auth flow and protected navigation`

### Dependency on Noel
- auth contract must be stable first

---

## Stage 3 — Rich-text editor and document lifecycle

### Objective
Meet the Assignment 2 baseline for rich-text editing, document CRUD, autosave, and version restore.

### Primary owners
- Ming Ming (frontend rich-text)
- Noel (backend document/list/version endpoints)

### Async-safe task list

#### Noel
- list documents endpoint
- create/load/update document endpoints in FastAPI
- version history endpoint
- restore/revert endpoint
- permission-enforced CRUD

#### Ming Ming
- replace lightweight editor with a proper editor library
- support headings, bold, italic, lists, and code blocks
- autosave status indication
- wire document load/save/version restore UX

### Suggested commits
- `feat(backend): add document list and CRUD routes in FastAPI`
- `feat(backend): add version history and restore endpoints`
- `feat(frontend): integrate rich-text editor with core formatting`
- `feat(frontend): wire autosave and version restore UI`
- `test(frontend): cover document load save and restore flows`

### Dependency order
- Noel should land list/load/save contracts before Ming Ming finishes integration

---

## Stage 4 — AI streaming backend

### Objective
Satisfy the hard streaming requirement and keep the AI provider swappable.

### Primary owners
- Nurtore (AI streaming design and implementation)
- Noel (FastAPI integration path if needed)

### Async-safe task list

#### Nurtore must implement
- provider interface cleanup
- configurable prompt modules
- scoped context logic
- streaming rewrite endpoint
- streaming summarize endpoint
- streaming translate endpoint
- cancel support
- partial output policy
- AI failure/error mapping

#### Noel supports
- FastAPI route integration and auth/permission enforcement
- persistence for AI interaction history

### Suggested commits
- `refactor(ai): add provider abstraction and prompt modules`
- `feat(ai): stream rewrite responses token-by-token`
- `feat(ai): add streaming summarize and translate`
- `feat(ai): support generation cancellation and mid-stream errors`
- `test(ai): cover streaming and provider failure scenarios`

### Dependency on frontend
- event format must be frozen before Ming Ming integrates streaming UI

---

## Stage 5 — AI suggestion UX and AI history

### Objective
Make the AI features product-grade, not just technically present.

### Primary owners
- Ming Ming (AI UX)
- Nurtore (AI history and data model)

### Async-safe task list

#### Ming Ming
- progressively render streamed tokens
- cancel button
- side-by-side or panel comparison UX
- accept/reject/edit flow
- undo after acceptance
- AI history panel in the frontend

#### Nurtore
- AI interaction history API
- persistence of prompt/model/response/status
- accepted/rejected/applied metadata
- optional cost tracking

### Suggested commits
- `feat(frontend): render streamed ai output progressively`
- `feat(frontend): add ai suggestion compare and cancel UX`
- `feat(ai): persist ai interaction history`
- `feat(frontend): add per-document ai history panel`
- `test(frontend): cover ai streaming and suggestion interactions`

---

## Stage 6 — Realtime auth, polish, and testing hardening

### Objective
Harden the collaboration path to Assignment 2 expectations and eliminate the kind of issues that caused earlier deductions.

### Primary owners
- Noel (realtime auth path)
- Ming Ming (frontend reconnect UX)
- Tabina (docs, CI, runnability)

### Async-safe task list

#### Noel
- document exact websocket/session auth path
- ensure authenticated websocket/session join is explicit
- server-side permission enforcement remains airtight

#### Ming Ming
- reconnect UX polish
- presence list polish
- clear token-expiry UX without raw 401s during editing

#### Tabina
- CI should run the official test command cleanly
- README commands should be verified from clean setup
- ensure run script works from a fresh clone

### Suggested commits
- `docs(auth): document websocket authentication lifecycle`
- `fix(frontend): handle token expiry gracefully during editing`
- `feat(frontend): polish reconnect and presence UX`
- `ci(repo): verify assignment2 run and test commands`

---

## Stage 7 — Final integration and grading hardening

### Objective
Make the final submission unambiguous for the evaluator.

### Owners
- Everyone, coordinated by Tabina

### Checklist
- merge to final `main`
- verify `README.md`
- verify `DEVIATIONS.md`
- verify `.env.example`
- verify run command
- verify tests
- verify docs and diagrams
- verify all four contributors are visible in Git history
- rehearse live demo against the actual running system

### Suggested commits
- `docs(repo): finalize assignment2 evaluator quickstart`
- `docs(deviations): document design and implementation changes`
- `chore(repo): finalize assignment2 submission branch into main`

---

## Maximum-Grade Deliverables Checklist

By submission time, the repository should include:

- React frontend
- FastAPI backend
- register/login/refresh with hashed passwords
- protected routes
- authenticated realtime join path
- streaming AI with cancellation
- at least two AI features
- rich-text editor
- dashboard for owned/shared docs
- version restore
- AI history UI
- tests
- root run script or Makefile
- root `.env.example`
- FastAPI docs
- `DEVIATIONS.md`
- clean GitHub evidence from all four team members

## Final Advice

For maximum grade, optimize for these three things simultaneously:

1. the code must satisfy the Assignment 2 baseline,
2. the repository must make team ownership and workflow evidence obvious,
3. the evaluator must be able to run the documented command paths without surprises.

That means the safest strategy is to keep the work split sharp, freeze interfaces early, and avoid a late-stage
giant merge where nobody's ownership is visible anymore.
