# Assignment 2 Deviations

This document records the major differences between the Assignment 1 design intent and the final Assignment 2 implementation.

For each major deviation, it states:

1. what changed,
2. why it changed,
3. whether the change was an improvement or a compromise.

## 1. FastAPI Became The Authoritative Backend

- Assignment 1 design direction:
  A Node/Express backend existed in the earlier repository structure and supported the initial PoC path.
- Final implementation:
  `backend_fastapi/` is the authoritative Assignment 2 backend. It owns authentication, document CRUD, permissions, sessions, AI orchestration, exports, and OpenAPI docs.
- Why it changed:
  Assignment 2 required a Python/FastAPI-based backend path. Keeping Express as the main runtime would have conflicted with the final technology direction.
- Improvement or compromise:
  Improvement. The final implementation is closer to the brief and provides a clearer API/documentation story.

## 2. The Realtime Layer Remains A Separate Node/Yjs Relay

- Assignment 1 design direction:
  Collaboration was already built around Yjs and a dedicated websocket layer.
- Final implementation:
  The FastAPI backend issues signed collaboration sessions, but the actual realtime relay remains a separate Node/Yjs service under `realtime/`.
- Why it changed:
  The Yjs relay was already stable and highly specific to collaborative transport concerns. Rewriting it inside FastAPI would have added risk without improving the coursework outcome.
- Improvement or compromise:
  Mild compromise architecturally, but a practical improvement for delivery confidence. The split remains clean because auth/session authority still stays in FastAPI.

## 3. Rich Text Is Persisted As HTML Fragments

- Assignment 1 design direction:
  The editor experience was intended to resemble a modern collaborative document editor.
- Final implementation:
  The rich-text editor stores document content as HTML fragments in SQLite rather than a more complex structured document model.
- Why it changed:
  This keeps persistence, autosave, versioning, and export simple while still delivering visible formatting support.
- Improvement or compromise:
  Acceptable compromise. It reduces implementation complexity while still satisfying the requirement for a real rich-text editor.

## 4. Password Recovery Uses A Local One-Time Token Instead Of Email Delivery

- Assignment 1 design direction:
  No final password-recovery mechanism was fully implemented in the earlier design stage.
- Final implementation:
  The system exposes a forgot-password/reset-password flow, but in the local coursework environment it issues a one-time reset token directly instead of integrating an email provider.
- Why it changed:
  Email delivery would add infrastructure and external-service complexity that is unnecessary for a local runtime.
- Improvement or compromise:
  Practical compromise. The security-sensitive reset lifecycle is still implemented, but the transport is simplified for coursework use.

## 5. WebSocket Authentication Uses A Signed Subprotocol Token

- Assignment 1 design direction:
  Session auth existed conceptually, but implementation details evolved as the security model became more concrete.
- Final implementation:
  The backend issues a signed collaboration session token, and the frontend passes it via WebSocket subprotocol rather than as a query-string token.
- Why it changed:
  Query-string tokens are weaker because they can leak through URLs and logs. The subprotocol approach is cleaner and stronger operationally.
- Improvement or compromise:
  Improvement. This is a direct security hardening over a weaker common shortcut.

## 6. Refresh Rotation Invalidates Older Access-Token Sessions Immediately

- Assignment 1 design direction:
  Session lifecycle detail was not fully nailed down in the earlier design artifacts.
- Final implementation:
  Access tokens are tied to the active refresh-token session. Refreshing rotates the session and invalidates older access-token sessions rather than only waiting for expiry.
- Why it changed:
  This closes a real security gap and makes the token lifecycle easier to defend under questioning.
- Improvement or compromise:
  Improvement. It is a stronger session model than a simple “let old access tokens expire naturally” policy.

## 7. AI Streaming Supports Both Deterministic Stub Mode And LM Studio Mode

- Assignment 1 design direction:
  AI features were originally discussed at a design level, but the provider/runtime specifics were still open.
- Final implementation:
  The backend always exposes streamed AI endpoints. For evaluation reliability, the AI layer supports both:
  - a deterministic stub provider, and
  - a local LM Studio / OpenAI-compatible provider.
- Why it changed:
  This allows the system to remain testable and runnable even if a local model endpoint is unavailable, while still supporting a real model-backed path.
- Improvement or compromise:
  Improvement in delivery robustness. It balances reproducibility and real AI capability.

## 8. AI Apply Includes A Stale-Source Guard Under Collaboration

- Assignment 1 design direction:
  AI assistance and collaboration were originally designed as complementary features, but the exact race conditions between them were not fully addressed in the initial design.
- Final implementation:
  AI suggestions are only applied if the source text in the target range still matches the text that the suggestion was generated from. If another collaborator changed that text first, apply is blocked and the user must rerun AI.
- Why it changed:
  Without this safeguard, delayed AI application can silently overwrite newer collaborative edits.
- Improvement or compromise:
  Strong improvement. This is a correctness hardening specifically for collaborative editing.

## 9. Share-By-Link Was Added Beyond Direct User Grants

- Assignment 1 design direction:
  Direct owner/editor/viewer permission management was part of the planned collaboration model.
- Final implementation:
  In addition to direct grants, owners can create share links with a chosen role and revoke those links. They can also optionally revoke access originally granted through a link.
- Why it changed:
  This creates a clearer sharing workflow and improves practical usability.
- Improvement or compromise:
  Improvement. It exceeds the baseline sharing experience and strengthens the demo story.

## 10. Exports Use An Async Job Flow, But Produce Real Files

- Assignment 1 design direction:
  Export support existed conceptually and could have been implemented in a simplified way.
- Final implementation:
  TXT and JSON exports return immediately, while PDF and DOCX follow an async job flow and generate real downloadable files.
- Why it changed:
  The async flow preserves orchestration clarity while still producing real downloadable output.
- Improvement or compromise:
  Improvement. It preserves architecture clarity and still delivers real exported files.

## 11. The Legacy Express Backend Remains In The Repository As Historical Reference

- Assignment 1 design direction:
  The original repo included a Node/Express backend path.
- Final implementation:
  The old backend remains in the repository, but it is explicitly marked as historical/reference only and is not part of the Assignment 2 runtime path.
- Why it changed:
  Removing it entirely late in the project risked destabilizing migration references and historical context.
- Improvement or compromise:
  Mild compromise. Keeping it is acceptable as long as it is clearly demoted and cannot be mistaken for the final runtime.

## 12. Historical Assignment 1 Materials Are Preserved But Demoted

- Assignment 1 design direction:
  The repository contained a polished Assignment 1 report package and related planning artifacts.
- Final implementation:
  Those materials remain in the repository for traceability, but the Assignment 2 report now lives separately under `assignment2-report/`, and historical content is clearly labeled as archival.
- Why it changed:
  This preserves evidence/history while avoiding confusion about what belongs to the final submission.
- Improvement or compromise:
  Improvement, provided the historical artifacts stay clearly marked and subordinate to the Assignment 2 package.

## Summary Judgment

Most final deviations were not random changes; they were either:

- required to satisfy the Assignment 2 brief more directly,
- security/correctness improvements discovered during implementation, or
- pragmatic compromises made explicit to avoid silent design drift.

The final implementation differs from the earlier design in targeted, documented ways. Some changes were direct improvements in security or correctness, while others were practical compromises made to keep the system reliable and aligned with the Assignment 2 brief.
