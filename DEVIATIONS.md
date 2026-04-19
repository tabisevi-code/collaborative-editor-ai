# Assignment 2 Deviations

This file tracks the remaining intentional deviations between the brief and the submitted implementation.

## 1. Realtime service remains a separate Node/Yjs relay

- Brief expectation: collaboration can be implemented using any suitable realtime transport.
- Current state: the authoritative backend is FastAPI, but the Yjs/WebSocket relay remains a separate Node service.
- Reason: the existing relay was already stable and deeply tied to Yjs protocol handling.
- Resolution status: accepted architectural deviation, documented rather than hidden.

## 2. Rich text is persisted as HTML fragments

- Brief expectation: a real rich-text editor with formatting support.
- Current state: the editor is real rich text, and formatted content is persisted as HTML strings in SQLite.
- Reason: this keeps the persistence and realtime model simple while still delivering visible rich-text behavior.
- Resolution status: accepted implementation choice.

## 3. AI backend streaming is provider-streamed when available and backend-chunked otherwise

- Brief expectation: token-by-token or chunked backend streaming.
- Current state: FastAPI always streams to the frontend; the stub/default provider chunks on the backend, while an OpenAI-compatible provider can still be swapped in.
- Reason: this guarantees compliant backend streaming even without a live model endpoint during evaluation.
- Resolution status: accepted implementation choice.

## 4. PDF and DOCX exports are simulated async jobs

- Brief expectation: export support is optional to the core Assignment 2 requirements.
- Current state: TXT and JSON export immediately, while PDF and DOCX follow an async-job flow with placeholder content rather than full binary rendering.
- Reason: the coursework emphasis is on architecture, async workflows, and evaluator-visible behavior rather than document-rendering fidelity.
- Resolution status: temporary simplification, explicitly documented.

## 5. Legacy Node backend remains in the repository

- Brief expectation: FastAPI backend.
- Current state: FastAPI is the runnable Assignment 2 backend, but the earlier Express backend remains in the repo as migration history and as a schema/bootstrap dependency used by the realtime service.
- Reason: removing it entirely would add risk late in the delivery cycle and offers little grading value.
- Resolution status: repository-history deviation only; not the submitted runtime path.
