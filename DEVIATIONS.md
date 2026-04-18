# Assignment 2 Deviations

This document tracks every meaningful deviation between the Assignment 2 brief, the Assignment 1 target
architecture, and the evolving implementation.

It should be updated throughout Assignment 2 work rather than only at the end.

## Current Known Deviations

### 1. Backend stack
- **Brief expectation:** FastAPI backend
- **Current state:** Repository still contains the Assignment 1 Node/Express backend as the runnable path
- **Reason:** The team is transitioning from Assignment 1 MVP to Assignment 2 implementation incrementally rather than replacing the backend in one risky step
- **Planned resolution:** Introduce a dedicated FastAPI backend and migrate contracts/features progressively

### 2. Authentication model
- **Brief expectation:** registration, securely hashed passwords, JWT access tokens, refresh tokens
- **Current state:** Delivered MVP currently uses simplified local bearer-token login through `POST /auth/login`
- **Reason:** Assignment 1 prioritized demonstrable architecture and feasibility over full authentication lifecycle
- **Planned resolution:** FastAPI backend will own registration, login, refresh, password hashing, and protected route enforcement

### 3. AI response delivery
- **Brief expectation:** token-by-token streaming via SSE, WebSocket, or chunked HTTP response
- **Current state:** Assignment 1 MVP uses asynchronous AI jobs with polling
- **Reason:** Polling was simpler and sufficient for Assignment 1, but does not satisfy the Assignment 2 streaming requirement
- **Planned resolution:** Add real backend streaming and align frontend AI UX with it

### 4. Dashboard data source
- **Brief expectation:** dashboard listing documents the user owns or has access to
- **Current state:** frontend groundwork exists, but current dashboard state is not yet backed by a final backend list-documents contract
- **Reason:** frontend scaffolding landed before the Assignment 2 backend migration
- **Planned resolution:** add backend-backed dashboard endpoints and replace temporary client-side state

## How To Use This File

For each additional deviation, add:

- what changed
- why it changed
- whether it is an improvement or a temporary compromise
- what the final intended resolution is
