
> Historical architecture decision record from earlier design stages.
> The final Assignment 2 AI implementation supports a deterministic stub provider and a local LM Studio/OpenAI-compatible provider in `backend_fastapi/app/ai/`.

ADR 004 — AI Model Strategy - Nurtore
Title:
AI Model Strategy for Writing Assistant
Status:
Proposed
Context:
The system must support AI-powered rewrite, summarization, and translation features inside a collaborative editor. The AI must be useful, fast enough for interactive workflows, and affordable to operate. The design must also consider privacy, since document content may be sensitive, and must avoid adding unnecessary implementation complexity in the first version of the product.
Decision:
Use one general-purpose third-party hosted LLM for the MVP across all AI features, including rewrite, summarization, and translation.
The system will:
·   	use the same model for all supported AI tasks in the first version
·   	send only selected text plus minimal surrounding context by default
·   	enforce usage limits through quotas and input-size restrictions
·   	keep model access behind a backend service so the provider or prompt logic can be changed later without frontend changes
Consequences:
Positive:
·   	simpler implementation and integration
·   	faster development for MVP
·   	easier testing, monitoring, and debugging
·   	consistent AI behavior across features
·   	easier quota and cost management
Negative:
·   	one model may not be optimal for every task
·   	translation or summarization quality may be weaker than with specialized models
·   	reliance on a third-party provider introduces privacy and availability risks
·   	future scaling may require model routing logic if usage grows
Alternatives considered:
1. 	Multiple specialized models for different tasks
·   	Rejected for MVP because it increases integration complexity, testing effort, and operational overhead.
2. 	Self-hosted or local open-source models
·   	Rejected because infrastructure, deployment, and maintenance costs are too high for the first version.
·   	Also increases latency and team workload.
3. 	Full-document context by default for all AI requests
·   	Rejected because it increases cost, latency, and privacy risk.
·   	Selected-text scope is more efficient and safer for most user actions.
