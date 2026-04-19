# AI1220 Assignment 1 Presentation Script

> Historical Assignment 1 artifact.
> The current runnable Assignment 2 system is documented through the root `README.md`, `DEMO.md`, `docs/assignment2-current-state.md`, and `docs/assignment2-contracts.md`.

This script is designed for a recorded video of about 10 minutes and follows the instructor's required order:

1. Team responsibilities and contributions
2. Important design decisions using the produced schemes and diagrams
3. A proof-of-concept / MVP video with the system in action

To reduce switching during recording, each member appears once in one contiguous block.

---

## Recommended Recording Setup

- Keep `final-report/main.pdf` open.
- Keep the app already running from:

```bash
npm run dev:all
```

- Use a fresh document after reset.
- Keep two browser windows or tabs ready.
- Optional quick backup tab: `http://localhost:3000/docs/`

---

## Timing Plan

| Time | Speaker | Topic |
|---|---|---|
| 0:00-2:40 | Tabina | Team responsibilities, architectural drivers, C4 Level 1 and Level 2 |
| 2:40-5:00 | Noel | Backend architecture, API contracts, auth/authorization, communication model |
| 5:00-6:40 | Nurtore | AI integration design, data model, ADR-level tradeoffs |
| 6:40-10:00 | Ming Ming | Frontend UX, repository/test flow, and full live MVP demo |

---

## Speaker 1: Tabina (0:00-2:40)

**On screen:** Title page, team responsibilities, architectural drivers, C4 Level 1, C4 Level 2

**Script:**

"Hello, we are presenting our collaborative document editor with AI writing assistant for AI1220 Assignment 1.

Our team divided responsibilities clearly so that architecture, backend, AI, and frontend decisions stayed aligned throughout the project.

I, Tabina, focused on overall architecture and infrastructure direction, including the C4 diagrams, repository organization, and final consistency checks. Noel focused on backend and API contracts, Nurtore focused on AI and the data model, and Ming Ming focused on frontend UX and collaboration behavior.

Before designing the system, we ranked the architectural drivers that mattered most. The most important was collaboration correctness and convergence, because if multiple users cannot trust the shared document state, the product fails its core purpose. The next drivers were low-latency user experience, maintainability for a small student team, and AI predictability and cost control.

At the system-context level, the editor sits between users, an identity-provider concept, and an LLM provider. In the delivered MVP, we simplified authentication to local bearer-token login, but we kept the identity-provider boundary in the architecture because that remains the target production direction.

At the container level, we separated the system into a React frontend, an Express backend API, a dedicated realtime service, a database layer, and an AI integration service. This separation matters because REST persistence and realtime collaboration have different responsibilities. The backend handles documents, permissions, versions, AI jobs, export jobs, and session issuance, while the realtime service handles Yjs synchronization, awareness, and viewer write protection. The delivered MVP uses SQLite because reproducibility and deterministic setup were more valuable for this assignment than production-scale deployment complexity." 

---

## Speaker 2: Noel (2:40-5:00)

**On screen:** C4 Level 3 backend diagram, role matrix, API design section, communication model section

**Script:**

"Inside the backend API, we used a layered structure with routes and controllers, authentication middleware, service logic, and repositories. This kept the backend modular and testable as the MVP expanded beyond the original proof of concept.

The routes translate HTTP requests, the auth middleware validates bearer tokens, and the services enforce document-scoped authorization and business rules. We split the backend into document service, version and revert logic, permission management, AI job handling, export jobs, and realtime session issuance.

The repository layer isolates SQL from service logic, which made the code much easier to reason about than a single persistence god file.

The communication model is hybrid. REST handles document create, load, save, permissions, versions, AI jobs, export jobs, and session issuance. Realtime collaboration uses Yjs over WebSocket. The frontend first loads the document over REST, then calls `POST /sessions`, and then joins the realtime service using a signed WebSocket URL.

This gave us a clean division of responsibilities: persistence and policy remain in the backend, while low-latency synchronization remains in the realtime service.

The backend also uses one standard JSON error schema for all non-2xx responses, so the frontend can distinguish permission errors, validation failures, not-found conditions, AI failures, and quota limits consistently." 

---

## Speaker 3: Nurtore (5:00-6:40)

**On screen:** AI integration design, ER/data model, AI job sequence flow

**Script:**

"The AI assistant was designed as a real product feature rather than a basic API demonstration.

We decided that AI should operate on selected text plus minimal surrounding context by default. That reduces cost, lowers latency, and avoids sending unnecessary private content to the model.

We also modeled AI as asynchronous jobs. The frontend submits rewrite, summarize, or translate requests, the backend returns a job ID quickly, and the frontend polls for completion. This avoids blocking the editor and makes AI failures visible without affecting the rest of the system.

In the delivered MVP, suggestions appear in a side panel. The user can reject them, apply them fully, or apply only a selected portion of the AI output. Applying AI is integrated with versioning, so AI-related changes remain auditable and reversible.

From the data-model perspective, the core entities are users, documents, versions, permissions, and AI interactions, and the implementation also includes AI policy, export jobs, realtime events, audit logs, and idempotency keys. That is important because AI, collaboration, permissions, and document history all depend on the same underlying document lifecycle." 

---

## Speaker 4: Ming Ming (6:40-10:00)

**On screen:** frontend editor, then live system demo

**Script:**

"From the frontend side, our goal was to make the system intuitive for users while still reflecting the backend contracts and realtime model accurately.

The frontend loads document state through REST, requests a realtime session, then connects to the Yjs/WebSocket collaboration layer. We also focused on practical UX features such as autosave, readable AI suggestion review, version history, permissions, and clear error states.

The repository is also organized for reproducibility. We added root scripts for install, run, testing, and demo reset, plus Docker Compose and CI, so the architecture is not only described but operationally reproducible.

Now I’ll show the delivered MVP in action.

First, we sign in as `user_1` using the local login screen and create a new document. This demonstrates that authentication is a visible part of the MVP rather than a hidden developer shortcut, and it confirms that the core document contract works end to end.

Next, we open the same document in a second tab and sign in as `user_2`. From the owner account, we grant editor access. Once access is granted, both users can type into the same document and see each other’s edits in real time. We also show the presence indicators so collaborators can see who is online.

After typing, the document autosaves through the backend, and the header returns to a saved state. We can then open the version history and inspect immutable version entries.

Next, we select some text and invoke the AI assistant. The request creates an asynchronous AI job, and once it completes, the suggestion is shown in a side panel. We can reject it, apply it fully, or apply only a selected part of the AI output.

Finally, we revert to an earlier version and show that both collaborators converge to the reverted state. We also briefly open the backend Swagger/OpenAPI docs at `/docs`, which reflects the same API contract used by the frontend.

In summary, our project translates the assignment’s requirements into a concrete, testable, and demoable collaborative editor architecture, and the delivered MVP shows that the design decisions hold together in practice." 

---

## Fallback Lines

Use these only if something goes wrong during recording.

### If realtime reconnects slowly
"The collaboration channel is reconnecting, but the persisted document state remains intact and the client resumes synchronization once the realtime service is available again."

### If LM Studio is unavailable
"The MVP supports both a real local model endpoint and a deterministic stub provider, so the same async AI workflow still works reliably for demo purposes."

### If you need to shorten the talk
Cut detail from:
- the architectural drivers explanation
- the tradeoff explanation in the AI section

But keep all three required parts:
- responsibilities
- design decisions
- live system demo
