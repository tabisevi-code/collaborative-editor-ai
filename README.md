# Collaborative Editor AI

Course project: collaborative document editor with AI assistant.

---

## Repository Structure (Monorepo)

This project follows a monorepo structure.
/frontend → React Web Application
/backend → REST API (Node / Express)
/realtime → WebSocket Real-Time Service
/ai-service → AI Integration Service
/shared → Shared types and constants
/config → Configuration templates
/docs → Architecture documentation and ADRs


---

## System Architecture Overview

The system consists of:

- Frontend (React Web App)
- Backend API (Node / Express)
- Real-Time Service (WebSocket)
- AI Integration Service
- PostgreSQL Database
- External LLM API Provider
- Identity Provider (OAuth / OIDC compatible)

---
## Development Status

Backend PoC implemented:
- POST /documents
- GET /documents/:id
- Standardized error responses
- Contract tests
- Smoke tests

---

## How to Run Backend

```bash
cd backend
npm install
npm test
