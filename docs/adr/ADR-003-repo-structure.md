> Historical architecture decision record from earlier design stages.
> The final Assignment 2 runtime uses `backend_fastapi/` as the authoritative backend path; this ADR remains only as design history.

ADR-003: Repository Structure Strategy 
Context
The project consists of multiple logical components:
Frontend (React Web App)
Backend API (Node / Express)
Real-Time Service (WebSocket Server)
AI Integration Service
Shared type definitions and configuration
The team must decide whether to use:
A monorepo (single repository containing all services)
Multiple repositories (one per service)
The decision must consider:
Team size (4 members)
Coordination overhead
Shared type definitions (e.g., request/response models)
CI/CD simplicity
Academic project scope

Decision
Adopt a monorepo structure containing:
/frontend
/backend
/realtime
/ai-service
/shared
/config
/tests
All services will exist in a single repository.
Shared types and configuration will be placed in a /shared directory.
Secrets and environment configuration will be handled via .env files excluded from version control.

Consequences
Pros:
Simplifies dependency management.
Shared types prevent request/response mismatches.
Easier coordination between frontend and backend teams.
Single CI/CD pipeline.
Easier local development setup.
Cons:
Repository becomes larger over time.
Requires discipline to avoid tight coupling between services.
CI builds may run longer if not properly scoped.
Alternatives Considered
Multi-repository approach
Separate repositories for frontend, backend, and services.
Pros: Clear separation, independent versioning.
Cons: Higher coordination overhead, shared type duplication, more complex CI/CD.
Rejected due to increased complexity for a small academic team.
Hybrid approach
Backend services in one repo, frontend separate.
Rejected due to shared API contract complexity. 
