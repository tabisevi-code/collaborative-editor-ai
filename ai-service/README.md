# AI Integration Service

> Historical legacy service artifact.
> The Assignment 2 final runtime uses the AI implementation inside `backend_fastapi/app/ai/`.

This folder contains the AI execution core for interacting with an external LLM provider.

Responsibilities:
- Create async AI jobs in memory
- Execute rewrite / summarize / translate requests through a provider adapter
- Build prompt templates from selected text plus minimal context
- Normalize provider failures into stable AI error codes
- Return job snapshots without directly modifying document content

Explicit non-responsibilities:
- Authentication / authorization
- RBAC or quota policy enforcement
- Writing to documents / versions
- Realtime or websocket flows
- Persistent database storage

Technology:
- Node.js
- Deterministic stub provider for local demos
- OpenAI-compatible REST client for LM Studio

Current internal contract:
- `createAiJob(input)`
- `runAiJob(jobOrJobId)`
- `getAiJobStatus(jobId)`

Current public job snapshot:
- `jobId`
- `status`
- `proposedText?`
- `baseVersionId`
- `errorCode?`
- `errorMessage?`
- `createdAt`
- `updatedAt`
