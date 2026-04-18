# Assignment 2 Current State and Remaining Work

This document maps the current repository state to the Assignment 2 brief and shows what is still left to do for a maximum-grade submission.

It is based on the latest fetched remote state, including the merged frontend Assignment 2 PR on `origin/main`.

## 1. Current Remote State

As of the latest fetch:

- `origin/main` has already merged `a2/mingming-frontend`
- the current backend on `origin/main` is still Node/Express
- the current realtime layer is still the separate Yjs/WebSocket relay service
- the final Assignment 1 report package is still local and not part of the main tracked repository flow

This means Assignment 2 work has started, but the repository is still far from the final required state.

## 2. What Is Already Strong in `origin/main`

The current codebase already has a strong starting point:

- React frontend exists and is functional
- live collaboration with Yjs + WebSocket exists
- permissions / RBAC exist
- versions and revert exist
- AI features already exist conceptually (rewrite/summarize/translate)
- AI suggestion UX is already beyond a trivial baseline
- tests and repo structure are stronger than a typical baseline submission
- README, Docker, CI, and demo docs exist

So Assignment 2 is not starting from nothing. It is a migration and completion problem, not a bootstrap problem.

## 3. Biggest Remaining Gaps vs Assignment 2 Brief

### 3.1 Hard blockers

These are the items that still block a convincing full-grade Assignment 2 submission.

1. **FastAPI backend not implemented**
   - Assignment 2 expects FastAPI
   - current backend is still Node/Express

2. **Real JWT auth lifecycle not implemented**
   - current frontend auth UI has landed, but it is backed by a temporary frontend-side auth adapter
   - there is still no real backend registration + hashed passwords + JWT refresh flow

3. **AI streaming is still not real backend streaming**
   - current frontend branch approximates streaming on the client side
   - Assignment 2 requires actual token streaming from the backend

4. **Dashboard is not backend-backed yet**
   - current dashboard logic uses frontend-local storage instead of a real list-documents backend contract

5. **No explicit `DEVIATIONS.md` yet**
   - Assignment 2 requires clear documentation of architectural deviations

### 3.2 Important but not the very first blockers

6. Proper rich-text editor with required formatting support
7. AI history API + UI
8. WebSocket auth documentation and backend enforcement clarity in Assignment 2 docs
9. Root `.env.example` for Assignment 2 stack
10. Root one-command run path aligned to the new stack

## 4. What the merged frontend PR already covered

The frontend PR from Ming Ming already contributes useful groundwork:

- login page UI
- register page UI
- session/auth context structure
- dashboard UI direction
- rich-text preview/editor direction
- AI streaming/history UX direction
- frontend tests around those areas

However, some of that work is still placeholder scaffolding rather than final Assignment 2-complete behavior.

### Important caveats

- `authAdapter.ts` is still a temporary frontend-side bridge and must be replaced by real backend auth
- `dashboard.ts` is still local-storage based and must be replaced by real backend-backed listing
- the AI “streaming” path in frontend is not yet backed by real token streaming from the backend

## 5. Exact Remaining Work by Owner

### 5.1 Tabina — Architecture / Infra / Docs / Deviations / CI

#### Already effectively covered or partially covered
- architecture direction
- repo structure and docs ownership
- diagrams and report discipline

#### Still left
- create `DEVIATIONS.md`
- create root `.env.example` for Assignment 2
- update root `Makefile` or `run.sh` to the final Assignment 2 stack
- update CI to run the new FastAPI-based backend path
- keep diagrams and docs aligned as the architecture changes
- maintain the work plan and freeze final submission shape

#### Good commit-worthy chunks
- `docs(deviations): add assignment2 deviation report`
- `chore(repo): add assignment2 env example and run entrypoint`
- `ci(repo): update workflow for assignment2 stack`
- `docs(diagrams): refresh architecture views for final assignment2 implementation`

### 5.2 Noel — FastAPI Backend / Auth / Protected Routes / Tests

#### Still left
- scaffold FastAPI backend
- implement registration
- implement login
- implement refresh token flow
- store hashed passwords
- protect all backend routes
- implement document list endpoint for dashboard
- re-express sessions route in FastAPI
- define authenticated websocket/session path cleanly
- port or recreate version/revert/permissions/export/AI routes in FastAPI
- write `pytest` tests for auth + protected CRUD + AI invoke + websocket auth basics

#### Highest-priority Noel tasks
1. FastAPI auth foundation
2. FastAPI document list + CRUD foundation
3. FastAPI sessions/authenticated realtime contract
4. backend tests

#### Good commit-worthy chunks
- `chore(backend): scaffold FastAPI application structure`
- `feat(auth): add register/login/refresh with JWT lifecycle`
- `feat(backend): add protected document list and CRUD routes`
- `feat(realtime): define authenticated session issuance for FastAPI backend`
- `test(backend): add pytest coverage for auth and protected routes`

### 5.3 Nurtore — AI Streaming / Prompt Modules / AI History / Data Model

This is the clearest place where Nurtore must leave visible GitHub evidence.

#### Still left
- implement real streaming AI backend behavior
- define provider abstraction for streaming output
- move prompts into structured templates/config modules
- add cancellation handling
- define and implement AI history persistence
- expose AI history API
- update data model and ER diagram to reflect Assignment 2 reality
- add AI streaming and history tests

#### Best work reserved specifically for Nurtore
These should remain for him so his GitHub contribution is obvious:

1. streaming provider adapter
2. prompt template module
3. AI history schema/API
4. AI interaction model updates
5. AI-specific tests
6. AI/data-model report and diagram updates

#### Good commit-worthy chunks
- `refactor(ai): introduce configurable prompt and provider modules`
- `feat(ai): stream rewrite responses from backend provider`
- `feat(ai): add summarize and translate streaming flows`
- `feat(ai): persist ai interaction history`
- `test(ai): add streaming and history coverage`

### 5.4 Ming Ming — Frontend Auth / Dashboard / Rich Text / Streaming UX

#### Already partially covered
- login/register UI shell
- dashboard UI shell
- rich-text direction
- AI streaming UX direction

#### Still left
- remove frontend-mock auth bridge and consume real backend auth
- remove local-storage dashboard source and consume real backend listing endpoint
- integrate final rich-text editor with Assignment 2 minimum formatting set
- integrate real backend streaming AI
- support cancel in-progress generation
- implement AI history UI using real backend data
- handle token refresh gracefully during active editing

#### Good commit-worthy chunks
- `refactor(frontend): replace mock auth adapter with backend JWT client`
- `refactor(frontend): wire dashboard to backend list-documents API`
- `feat(frontend): integrate rich-text editor with required formatting tools`
- `feat(frontend): render streamed AI output and cancellation`
- `feat(frontend): add AI history panel backed by API`

## 6. What Professors Could Check and What We Must Make Visible

For Assignment 2, visible evidence matters. Professors can inspect:

- whether each member has real commits in their owned area
- whether feature branches exist
- whether PRs exist and have meaningful descriptions
- whether `main` is the final runnable branch
- whether README commands work from a clean setup
- whether tests actually pass from the documented command
- whether deviations are documented instead of hidden

### Therefore we must ensure

1. every person has code commits, not only docs edits
2. every person uses their branch
3. PRs are not giant mixed dumps
4. `main` becomes the final submission branch before submission
5. README and test commands are always runnable

## 7. Recommended Stage Order From Today

### Stage A — Foundation
- Tabina: `DEVIATIONS.md`, `.env.example`, root run script
- Noel: FastAPI scaffold + auth contract
- Nurtore: AI streaming contract draft
- Ming Ming: validate frontend auth/dashboard assumptions against the new contracts

### Stage B — Auth and backend reality
- Noel: register/login/refresh/JWT/hashed passwords
- Ming Ming: login/register UI wired to real backend

### Stage C — Dashboard and document lifecycle
- Noel: list documents endpoint
- Ming Ming: dashboard from backend data
- Noel + Ming Ming: save/version integration

### Stage D — AI streaming
- Nurtore: backend streaming and prompt/provider modules
- Ming Ming: streaming UI + cancel

### Stage E — AI history and report alignment
- Nurtore: AI history API + data-model updates
- Ming Ming: AI history UI
- Tabina: docs and diagrams alignment

### Stage F — Final hardening
- everyone: tests, README, run script, CI, deviations, final demo prep

## 8. Maximum-Grade Condition

Assignment 2 becomes genuinely strong only when all of the following are true:

- FastAPI backend exists and is the main backend path
- JWT register/login/refresh works
- passwords are securely hashed
- all protected routes require auth
- websocket/session auth path is explicit and enforced
- dashboard is backend-backed
- rich-text editor exists with required formatting baseline
- AI streaming is real
- AI history exists
- tests are meaningful and pass from documented commands
- `DEVIATIONS.md` exists
- `main` is the final branch
- all four contributors are visibly represented in Git history

## 9. Immediate Action Items

If the team is about to start coding, do this first:

1. Noel creates the FastAPI auth branch
2. Tabina creates `DEVIATIONS.md`, `.env.example`, and run script branch
3. Nurtore creates the AI streaming branch
4. Ming Ming pauses merging more placeholder frontend work until Noel freezes the auth and dashboard contracts

That is the cleanest way to avoid rework.
