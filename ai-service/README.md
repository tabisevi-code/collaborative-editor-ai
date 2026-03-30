# AI Integration Service

This folder will contain the AI integration logic for interacting with the external LLM provider.

Responsibilities:
- Validate AI policy (quota, roles, aiEnabled)
- Build prompt templates
- Send requests to LLM provider
- Manage async AI jobs
- Store AIInteraction records

Technology:
- Node.js
- REST client to external LLM API
