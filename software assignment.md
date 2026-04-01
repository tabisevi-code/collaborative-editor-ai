# roles \+ tasks breakdown

***ROLE BREAKDOWN:*** 

#  **Tabina — Architecture & Infrastructure Lead**

**Owns overall system structure and coordination.**

* Lead architectural drivers discussion  
* Ensure requirements align with architecture  
* Create C4 Level 1 diagram  
* Oversee C4 Level 2 diagram  
* Write Feature Decomposition section  
* Write Code Structure & Repository Organization section  
* Decide monorepo vs multi repo  
* Define directory structure and config strategy  
* Write Development Methodology section  
* Define team ownership model  
* Define timeline and milestones  
* Create GitHub repository and manage branch protection  
* Write final README  
* Ensure traceability matrix is complete  
* Final consistency check before PoC

# **Noel — Backend Lead**

**Owns server-side system behavior and API contracts.**

* Review real-time collaboration feasibility  
* Write Document Management requirements  
* Write User Management requirements  
* Define latency and scalability targets  
* Create C4 Level 3 (Backend Component Diagram)  
* Write Authentication & Authorization architecture section  
* Co-write Communication Model  
* Design API endpoints and schemas  
* Define async AI handling strategy  
* Co-design Data Model with Nurtore  
* Write ADR for real-time sync strategy  
* Write ADR for API style decision  
* Implement backend PoC (Express server \+ endpoints)


#  **Nurtore — AI & Data Model Lead**

**Owns AI system logic and data structure design.**

* Write AI Assistant functional requirements  
* Define AI quota behavior and failure handling  
* Write Security & Privacy non-functional requirements  
* Write AI Integration Deep Design section  
  * Context scope  
  * Long document handling  
  * Prompt strategy  
  * Model selection  
  * Cost control  
  * Collaboration behavior  
* Decide polling vs event model for AI completion  
* Design Data Model (ER diagram)  
* Model AI interaction tracking and version linking  
* Write ADR for AI model strategy  
* Contribute AI-related risks

# **Ming Ming — Frontend Lead**

**Owns user experience and client-side behavior.**

* Write Real-Time Collaboration functional requirements  
* Write Usability non-functional requirements  
* Co-write User Stories  
* Confirm AI suggestion UX behavior  
* Co-design Communication Model  
* Validate API contract usability  
* Ensure role-based restrictions reflect in UI  
* Implement frontend PoC  
  * Simple editor  
  * Fetch API calls  
  * Display backend response  
* Help validate JSON contract matches documentation


# Requirements Engineering

## **STEP 1.1 (ALL)**

Question 1: What must never fail?  
Question 2: What must feel instant?  
Question 3: What is most expensive?  
Question 4: What would cause legal trouble?

Now discuss and rank top 5\.

**STEP 1.2 (Tabina)**

What is a stakeholder? A stakeholder is a type of person or organization that cares about your system. You must describe at least 4 types. Tabina types this section, then creates a table | Stakeholder Type | What They Want | What They Are Worried About | How They Affect System Design |

**STEP 2 (All)**  
Requirements

- REAL-TIME COLLABORATION : Ming ming types (Real-Time Text Synchronization, Cursor Presence, Conflict Handling) noel must confirm technical feasibility   
- AI ASSISTANT : Nurtore types (Rewrite Selected Text, Partial Acceptance, AI Failure Handling, ) Ming Ming must confirm how suggestion appears visually. Noel must confirm the backend can handle async AI calls.  
- DOCUMENT MANAGEMENT+ USER MANAGEMENT  : Noel types (Create Document, Version History, Revert Version, Role-Based Access)

For every requirement:

ID:  
Title:  
Trigger:  
System Behavior:  
Acceptance Criteria:

**STEP 3 (All)**

These are measurable constraints. Each person writes their part.

Latency \+ Scalability (Noel types):

Security \+ Availability \+ Privacy (Nurtore types):

Usability (Ming Ming types):

## **STEP 4 (Ming Ming \+ Nurtore)**

Location: Google Docs

### **User Stories**

Write minimum 10\.

Must include:

* Offline reconnect  
* Simultaneous edit conflict  
* AI partial accept  
* AI quota exceeded  
* Viewer tries to edit  
* Admin disables AI feature  
* User reverts version during collaboration  
* Export document  
* AI suggestion rejected  
* User loses internet and reconnects

All review.

## **STEP 5 (Tabina)**

### Create a Traceability Matrix

Create columns:

| User Story ID | Functional Requirement ID | Architecture Component |

Map every story to at least one requirement.

Map every requirement to at least one component.

# Architecture

**STEP 1 (Tabina)** 

### C4 Level 1 — System Context

Draw:

* User  
* Collaborative Editor System  
* AI Provider  
* Identity Provider

**STEP 2  (ALL)**

### C4 Level 2 — Container Diagram

Draw containers:

* Frontend (React)  
* Backend API (Node/Express)  
* Real Time Service  
* Database  
* AI Integration Service

Label:

* Responsibility  
* Technology  
* Communication type

**STEP 3.1 (Noel)**

Location: draw.io

C4 Level 3 — Component Diagram for Backend API

Draw internal components:

\- Controller

\- Service layer

\- Auth middleware

\- AI adapter

\- Repository layer

Show interactions.

**STEP 3.2 (Noel)**

Location: Google Docs

Write Authentication & Authorization architecture section:

\- Role matrix

\- Permission rules

\- AI access restrictions

\- Privacy implications

## 

## 

## **STEP 4 (Noel \+ Ming Ming)**

Location: Google Docs

### Communication Model

Explain:

* Push based sync model  
* What happens when user opens document  
* What happens if user disconnects  
* How reconnect works

## 

## **STEP 5(Nurtore)**

Location: Google Docs

### AI Integration Deep Design

Must answer:

* What context AI sees  
* Handling long documents  
* Prompt template strategy  
* Model selection  
* Cost control  
* Lock vs reconcile behavior  
* Suggestion UX  
* Undo behavior  
* Define how frontend knows AI is complete  
* Polling vs event subscription decision

## **STEP 6 (Noel)**

Location: Google Docs

### API Design

Define endpoints clearly:

POST /documents  
GET /documents/:id  
POST /ai/rewrite  
POST /sessions

For each:

* Request JSON  
* Response JSON  
* Error codes  
* Async behavior

Ming Ming confirms compatibility.

## 

## 

## 

## 

## **STEP 7.1 (Nurtore \+ Noel)**

Location draw.io

### Data Model \+ ER Diagram

Entities:

* User  
* Document  
* Version  
* Permission  
* AIInteraction

Define relationships clearly.

**STEP 7.2 (Tabina)**  
Location: Google Docs  
Write Code Structure & Repository Organization section:  
\- Decide monorepo vs multi repo  
\- Draw directory tree  
\- Define shared folder strategy  
\- Define config and secret management  
\- Define testing strategy

## 

## 

## **STEP 8 (Tabina)**

Location: Google Docs

### Feature Decomposition

Write:

* What frontend module does  
* What backend module does  
* What AI service does  
* What sync layer does  
* What storage does  
* Dependencies between modules

## **STEP 9(ALL)**

Location: Google Docs

### 4 Architecture Decision Records

Each ADR must include:

* Title  
* Status  
* Context  
* Decision  
* Consequences  
* Alternatives considered

Assign:

* Real time sync strategy → Noel  
* AI model strategy → Nurtore  
* Repo structure decision → Tabina  
* API style decision → Noel

# Project Management

## **STEP 1 (Tabina)**

Write Team Structures:

* Ming Ming owns /frontend  
* Noel owns /backend  
* Nurtore owns AI logic and data model  
* Tabina owns infrastructure and architecture

## **STEP 2.1 (Tabina \+ Noel)**

### Development Workflow

Define:

* Branch naming format  
* Pull request rules  
* Review rules  
* No direct commit to main  
* Code review criteria

## **STEP 2.2 (Tabina)**

Location: Google Docs  
Write Development Methodology section:  
\- Choose Scrum or Kanban  
\- Define iteration length  
\- Define backlog prioritization process  
\- Explain how non feature work is handled

## 

## **STEP 3(ALL)**

### **Risk Assessment**

Minimum 5 risks.

Each must include:

* Description  
* Likelihood  
* Impact  
* Mitigation  
* Contingency

## **STEP 4 (Tabina)**

### **Timeline and Milestones**

Write measurable milestones.

# Proof of Concept

## **STEP 1.1 (Tabina)**

## Create GitHub repository.

## Add collaborators.

## Protect main branch.

## **STEP 1.2 (Noel)**

Backend, inside repo, Create server.js.

Add:

* POST /documents  
* GET /documents/:id

Return JSON.

Commit and push.

## **STEP 2 (Ming Ming)**

Frontend, inside repo:

Create simple text area.  
Call backend API using fetch.

Display returned JSON.

Commit and push.

## **STEP 3 (Tabina)**

Write README in GitHub:

Include:

* Setup instructions  
* What PoC implements  
* What is not implemented  
* How to run backend  
* How to run frontend

## **STEP 4 (ALL)**

Compare:

* Documentation JSON  
* Real JSON

They must match exactly.

# work \- requirements engineering

# **1\. Requirements Engineering**

---

## **1.1 Architectural Drivers**

**(Contributors: Tabina, Ming Ming, Nurtore, Noel)**

Tabina : AI cost control matters because API calls cost money, affecting how much text we send and if we need to put usage limits.

Ming Ming : Real-time Collab, conflicts (two people editing the same thing at the same time), AI assistance conflicts

Nurtore: Collaboration in real time; low latency editing & responsiveness; handling during offline transition; Conflict resolution strategy (simultaneous edits \+ AI conflicts); privacy, and safe AI data handling

Noel: Real-time collaboration consistency & correctness, Low-latency editing & presence (must be like instant), Security, privacy, and access control

---

## **1.2 Stakeholder Analysis**

(Owner: Tabina)

Infrastructure team, Admin, AI service provider, Development team

### **1.2.1 Admin**

What they want : control on who can open which document & use what AI features

What they are worried about : unauthorized access, high AI costs or data leakage

How they influence system requirements : we need a permissions system, and a system to authorize access to document, as well as set limits for AI usage

### **1.2.2 AI service provider**

What they want : their API to be used properly, and to be paid for it

What they are worried about : harmful requests or too much context in messages

How they influence system requirements : we need limits on the amount of AI usage as well as context given, and add a way for the AI to handle harmful requests

### **1.2.3 Development team**

What they want : clear architecture, maintainable code, and a modular system

What they are worried about : a system that’s hard to debug

How they influence system requirements : modular architecture, and clean repo structure

### **1.2.4 Infrastructure team**

What they want : stable deployment, monitoring and logging activities, uptime

What they are worried about : crashes, downtime during collaboration, good scaling

How they influence system requirements : scalability planning, logging and monitoring, availability target of 99%

---

## **1.3 Functional Requirements**

### **1.3.1 Real-time Collaboration**

**(Owner: Leonard Jiang Mingming)**

High-level capability:  
The system shall support real-time collaborative editing where multiple authenticated users can edit the same document simultaneously with synchronized content updates and presence awareness.

1. Real-time collaboration

a) Session Join & Presence Broadcast  
i) Trigger: The user opens a file and enters collaboration mode.  
ii) System behaviour: The system establishes a collaboration connection, joins the user to the document’s collaboration session, and broadcasts a “join” event to other users in the same session.  
iii) Acceptance Criteria: Other online users see the new user appear in the online user list within 1 second.

b) Session Leave and Presence Timeout  
i) Trigger: A user closes the page or loses connection (intentional or unintentional).  
ii) System behaviour:  
• If the user leaves intentionally, the system broadcasts a “leave” event to other users in the same session.  
• If the user disconnects unintentionally, the system detects it via heartbeat timeout and marks the user offline, then broadcasts the presence update.  
iii) Acceptance Criteria:  
• Intentional leave: Other users see the user removed from the online list within 1 second.  
• Unintentional disconnect: Other users see the user marked offline within 10 seconds (timeout is configurable).

c) Real-time Text Operation Sync  
i) Trigger: A user edits the document content (insert/delete/replace text).  
ii) System behaviour: The client sends the edit operation to the server; the server applies operations in order and broadcasts the operation (or patch) to other clients in the same session.  
iii) Acceptance Criteria: Other users see the document content updated within 500 ms under normal network conditions (configurable upper bound, e.g., 2 seconds).

d) Remote Cursor & Selection Broadcast  
i) Trigger: A user moves the cursor or changes the text selection range.  
ii) System behaviour: The client sends throttled cursor/selection updates to the server, and the server broadcasts these updates to other users in the same session; other clients render remote cursors/selections with user identity.  
iii) Acceptance Criteria: Other users see remote cursor/selection updates within 300 ms (subject to throttling policy).

e) Role-based Edit Enforcement in Collaboration  
i) Trigger: A non-editor role (viewer/commenter) attempts to edit document content.  
ii) System behaviour: The server rejects the edit operation and returns an authorisation error; the client blocks editing and displays a permission message while continuing to receive collaboration updates.  
iii) Acceptance Criteria: Non-editors cannot modify document content, and the UI displays a clear permission error without disconnecting the collaboration session.

---

### **1.3.2 Document Management**

**(Owner: Noel)**

2\) Document Management (Owner: Noel)

* High-level capability: The system shall provide secure document lifecycle management (create, retrieve, update, version, revert, export) while maintaining correctness under concurrent collaboration and enforcing role-based access control.  
    
  FR-DOC-001 — Create Document  
* \- Description: The system shall allow an authenticated user to create a new document with metadata and initial content.  
* \- Trigger: User submits a create document request (e.g., clicks “New Document”).  
* \- System behaviour:  
  1.   \- Validate authentication and required inputs (title, initial content).  
  2.   \- Create a new Document with a unique documentId and timestamps.  
  3.   \- Set the requester as the Owner of the document.  
  4.   \- Create initial Version (versionNumber \= 1, reason \= initial\_create).  
  5.   \- Return document metadata, including currentVersionId.  
* \- Acceptance criteria:  
  1.   \- Returns 201 with {documentId, title, ownerId, createdAt, updatedAt, currentVersionId}.  
  2.   \- Unauthenticated request returns 401 with error code AUTH\_REQUIRED.  
  3.   \- Missing/invalid title or oversized content returns 400 with error code INVALID\_INPUT.


  FR-DOC-002 — Retrieve Document (Permission Enforced)

* \- Description: The system shall return document content and metadata only to users with permission for the document.  
* \- Trigger: User requests to view/open a document (e.g., GET /documents/:id).  
* \- System behaviour:  
  1.   \- Authenticate the request.  
  2.   \- Check the user’s role for the document (Viewer/Editor/Owner/Admin).  
  3.   \- If authorised, return document metadata plus latest content and revision marker.  
  4.   \- If unauthorised, deny access without leaking sensitive details.  
* \- Acceptance criteria:  
  1.   \- Authorised user returns 200 with {documentId, title, content, updatedAt, currentVersionId, role}.  
  2.   \- Unauthorised user returns either 403 (PERMISSION\_DENIED) or 404 (NOT\_FOUND) consistently across the system. (TBD in meeting)  
  3.   \- p95 response time \<= 300ms for typical documents (\<= 50KB) under normal load.


  FR-DOC-003 — Update Document Content (Idempotent Save)

* \- Description: The system shall allow Editors/Owners to update document content and avoid duplicate writes during retries.  
* \- Trigger: Editor/Owner submits an update with requestId (manual save or autosave).  
* \- System behaviour:  
  1.   \- Authenticate and authorise as Editor/Owner.  
  2.   \- Validate payload size and require requestId.  
  3.   \- If requestId has already been processed for this document, return the previous success response (idempotency).  
  4.   \- Otherwise, persist the update, update updatedAt, and return a new revisionId/etag.  
* \- Acceptance criteria:  
  1.   \- Viewer update attempt returns 403 with PERMISSION\_DENIED.  
  2.   \- Re-sending the same requestId does not create duplicate versions or an inconsistent state.  
  3.   \- Successful update returns 200 with {updatedAt, revisionId}.  
  4.   \- p95 commit time \<= 200ms (excluding real-time propagation).

  FR-DOC-004 — Version Snapshot Policy

* \- Description: The system shall create immutable version snapshots to support auditability and rollback.  
* \- Trigger: A version checkpoint occurs (based on configured policy).  
* \- System behaviour:  
  1.   \- Maintain a version policy: manual save creates a version and/or periodic autosnapshot during active editing.  
  2.   \- Always create a version snapshot before revert and before applying AI changes.  
  3.   \- Store each version with {versionId, versionNumber, createdAt, createdBy, reason, snapshotRef}.  
  4.   \- Ensure versions are immutable after creation.  
* \- Acceptance criteria:  
  1.   \- Every document has at least one version (created at document creation).  
  2.   \- Version numbers increase monotonically per document.  
  3.   \- Versions cannot be edited/deleted through standard APIs.  
  4.   \- Before revert and before apply-AI always creates a version snapshot.  
     

  FR-DOC-005 — List Version History  
* \- Description: The system shall allow authorised users to view document version history.  
* \- Trigger: User requests version history (e.g., GET /documents/:id/versions).  
* \- System behaviour:  
  1.   \- Authenticate and authorise (Viewer+).  
  2.   \- Return a list of version metadata sorted newest-first.  
  3.   \- Support pagination for large histories; exclude full content by default.  
* \- Acceptance criteria:  
  1.   \- Returns 200 with versions \[{versionId, versionNumber, createdAt, createdBy, reason}\].  
  2.   \- Supports limit \+ cursor (or page).  
  3.   \- Does not return full content unless explicitly requested.  
  4.   \- p95 response time \<= 300ms for up to 200 versions.


  FR-DOC-006 — Revert to Version (Collaboration-Safe)

* \- Description: The system shall revert a document to a prior version while preserving audit history and keeping active collaborators consistent.  
* \- Trigger: Authorised user requests revert with targetVersionId.  
* \- System behaviour:  
  1.   \- Authenticate and authorise revert action (Owner/Admin by default; Editor allowed is TBD).  
  2.   \- Create a “pre-revert backup” version snapshot.  
  3.   \- Replace document content with the targetVersion snapshot.  
  4.   \- Create a new version entry with reason \= revert referencing targetVersionId.  
  5.   \- Notify active collaboration sessions of a revert event so clients converge.  
* \- Acceptance criteria:  
  1.   \- Revert creates a new version entry; history is not rewritten.  
  2.   \- Active collaborators converge to reverted content within \<= 1s under normal network conditions.  
  3.   \- Unauthorised revert returns 403 PERMISSION\_DENIED.  
  4.   \- Non-existent targetVersionId returns 404 VERSION\_NOT\_FOUND.


  FR-DOC-007 — Export Document (Sync \+ Async)

* \- Description: The system shall allow exporting documents in common formats with async handling for heavy exports.  
* \- Trigger: User requests export with format (e.g., pdf/docx/txt).  
* \- System behaviour:  
  1.   \- Authenticate and authorise (Viewer+ by default).  
  2.   \- For lightweight exports (txt/json), generate synchronously.  
  3.   \- For heavy exports (pdf/docx), create an async export job and return jobId \+ statusUrl.  
  4.   \- Provide time-limited download URL when ready.  
* \- Acceptance criteria:  
  1.   \- Lightweight exports return 200 with download output/link.  
  2.   \- Heavy exports return 202 with {jobId, statusUrl}.  
  3.   \- Unauthorised export returns 403 PERMISSION\_DENIED.  
  4.   \- Download URLs expire within a configured window (e.g., \<= 15 minutes).


  FR-DOC-008 — Audit Logging for Critical Document Actions

* \- Description: The system shall record audit logs for security-relevant and irreversible actions.  
* \- Trigger: Any of: create document, update permissions, revert, export, apply AI suggestion, delete/archive.  
* \- System behaviour:  
  1.   \- Append an audit event with {actorId, documentId, actionType, timestamp, metadata}.  
  2.   \- Restrict audit log access to Admin/Owner.  
* \- Acceptance criteria:  
  1.   \- Audit events exist for all actions listed above.  
  2.   \- Audit logs are immutable and queryable by Admin/Owner for investigations.

---

### **1.3.3 User & Permission Management**

**(Owner: Noel)**

**High-level capability:**  
**The system shall authenticate users and enforce document-level authorisation (roles/permissions) across REST APIs and real-time sessions, including policy controls for AI usage to satisfy security, privacy, and cost constraints.**

FR-USER-001 — Authenticate User and Establish Session

* \- Description: The system shall authenticate users and establish a session/token required for accessing protected APIs and real-time collaboration.  
* \- Trigger: User signs in or presents an identity token to the system.  
* \- System behaviour:  
  1.   \- Validate identity using the configured authentication method (e.g., OAuth/OIDC for design; simplified local auth for PoC).  
  2.   \- Issue an access token/session with expiry, bound to the userId.  
  3.   \- Return minimal profile info (userId, displayName) and token expiry metadata.  
* \- Acceptance criteria:  
  1.   \- Successful auth returns 200 with {userId, accessToken (or session cookie), expiresIn}.  
  2.   \- Invalid credentials/token returns 401 with error code AUTH\_FAILED.  
  3.   \- Expired tokens are rejected with 401 AUTH\_EXPIRED.


  FR-USER-002 — Enforce Authorisation on Every Protected Request (Server-Side)

* \- Description: The system shall enforce authorisation checks on every protected endpoint using document-level roles.  
* \- Trigger: Any request is made to a protected resource (documents, versions, export, AI, permissions, sessions).  
* \- System behaviour:  
  1.   \- Validate authentication token.  
  2.   \- Resolve user role for requested documentId: Viewer, Editor, Owner, Admin.  
  3.   \- Check role against requested action (view/edit/share/revert/export/AI).  
  4.   \- Deny unauthorised actions without performing side effects.  
* \- Acceptance criteria:  
  1.   \- Missing/invalid auth returns 401 AUTH\_REQUIRED / AUTH\_FAILED.  
  2.   \- Forbidden action returns 403 PERMISSION\_DENIED with standard error schema.  
  3.   \- The viewer cannot update content; only permitted roles can revert/share (policy defined in role matrix).  
  4.   \- Authorization is enforced on the server-side even if the client UI hides buttons.


  FR-USER-003 — Grant / Update Document Permissions (Share Document)

* \- Description: The system shall allow Owners/Admins to grant or modify other users’ roles on a document.  
* \- Trigger: Owner/Admin submits a permission update request for a target user.  
* \- System behaviour:  
  1.   \- Authenticate and authorise the requester as Owner/Admin for the document.  
  2.   \- Validate target user exists, and role is valid.  
  3.   \- Create or update DocumentPermission(userId, documentId, role).  
  4.   \- Emit an audit log event (permission\_granted / permission\_updated).  
  5.   \- Notify active collaboration sessions to refresh role enforcement (optional but recommended).  
* \- Acceptance criteria:  
  1.   \- Success returns 200 with {documentId, targetUserId, role, updatedAt}.  
  2.   \- Non-owner/non-admin returns 403 PERMISSION\_DENIED.  
  3.   \- Invalid role returns 400 INVALID\_INPUT.  
  4.   \- Role changes take effect immediately for subsequent API calls and edit operations.


  FR-USER-004 — Revoke Document Access (Remove Collaborator)

* \- Description: The system shall allow Owners/Admins to revoke a user’s access to a document.  
* \- Trigger: Owner/Admin submits a revoke request.  
* \- System behaviour:  
  1.   \- Authenticate and authorise the requester as Owner/Admin.  
  2.   \- Remove/turn off the target user’s DocumentPermission entry.  
  3.   \- Emit an audit event (access\_revoked).  
  4.   \- If the target user is currently connected in a collaboration session, force a permission refresh and deny further edit ops (disconnect or downgrade to viewer based on policy).  
* \- Acceptance criteria:  
  1.   \- Success returns 200, and subsequent access by the target user returns 403/404 consistently with the doc-access policy.  
  2.   \- Any in-flight edit operations from revoked user are rejected (PERMISSION\_DENIED) within \<= 2s.  
  3.   \- Non-owner/non-admin revoke attempt returns 403 PERMISSION\_DENIED.


  FR-USER-005 — Role-Based Editing Enforcement in Real-Time Sessions

* \- Description: The system shall enforce roles during real-time collaboration, so non-edit roles cannot submit content operations.  
* \- Trigger: Client sends an edit operation in an active collaboration session.  
* \- System behaviour:  
  1.   \- Validate session authentication and map session to (userId, documentId).  
  2.   \- Check current role; reject write operations from Viewer (and from Commenter if that role exists).  
  3.   \- Allow read-only participation (receiving updates, presence) for viewers if policy allows.  
* \- Acceptance criteria:  
  1.   \- Viewer edit operations are rejected with PERMISSION\_DENIED and do not affect document state.  
  2.   \- Authorised editor operations are accepted and broadcast to other collaborators.  
  3.   \- Role changes (grant/revoke) reflect in enforcement without requiring a full system restart.


  FR-USER-006 — Admin Policy Controls for AI Usage (Cost \+ Privacy)

* \- Description: The system shall allow Admin/Owner to control AI availability and usage limits per org/document/role.  
* \- Trigger: Admin/Owner updates AI policy settings, or a user invokes an AI action.  
* \- System behaviour:  
  1.   \- Maintain AI policy settings, including:  
  2.     \- aiEnabled (boolean)  
  3.     \- allowedRolesForAI (e.g., Owner/Editor only)  
  4.     \- quota (requests/day or tokens/day) per user or per document  
  5.   \- Enforce policy at AI invocation time: deny if disabled, role not allowed, or quota exceeded.  
  6.   \- Log AI usage for auditing and cost monitoring.  
* \- Acceptance criteria:  
  1.   \- If aiEnabled=false, AI endpoints return 403 AI\_DISABLED.  
  2.   \- If the role is not allowed, AI endpoints return 403 AI\_ROLE\_FORBIDDEN.  
  3.   \- If quota exceeded, AI endpoints return 429 QUOTA\_EXCEEDED with reset window info (or Retry-After).  
  4.   \- Only Admin/Owner can modify AI policy; others receive 403 PERMISSION\_DENIED.


  FR-USER-007 — Standard Error Response Schema (Consistency Across APIs)

* \- Description: The system shall return a consistent error payload for all failure cases.  
* \- Trigger: Any API call fails validation/auth/authz/resource checks or server processing.  
* \- System behaviour:  
  1.   \- Return JSON error shape:  
  2.     \- error.code (stable machine-readable code)  
  3.     \- error.message (human readable)  
  4.     \- error.details (optional)  
* \- Acceptance criteria:  
*   \- All non-2xx responses include the standard error schema.  
*   \- Error codes are consistent across endpoints (AUTH\_REQUIRED, AUTH\_FAILED, PERMISSION\_DENIED, INVALID\_INPUT, NOT\_FOUND, AI\_DISABLED, QUOTA\_EXCEEDED).

---

### **1.3.4 AI Assistant Functional Requirements**

**(Owner: Nurtore)**

FR-AI-001 — Rewrite Selected Text

·   	Description: The system shall allow users to rewrite selected text using AI.  
·   	Trigger: User selects text and invokes Rewrite.  
·   	System Behaviour:

·   	Validate user permissions and AI quota  
·   	Capture selected text snapshot  
·   	Send request to AI service asynchronously  
·   	Return AI-generated suggestion without modifying original text

·   	Acceptance Criteria:

·   	Request returns within ≤ 500ms with job reference  
·   	AI response for ≤1500 characters completes within ≤ 10 seconds  
·   	Original text remains unchanged until user confirms  
·   	Unauthorized or quota-exceeded requests return 403 AI\_DISABLED or 429 QUOTA\_EXCEEDED

FR-AI-002 — Partial Acceptance of AI Suggestions

·   	Description: The system shall allow users to partially apply AI-generated suggestions.  
·   	Trigger: User receives AI suggestion.  
·   	System Behaviour:

·   	Display suggestion as editable proposal (diff/inline/side panel)  
·   	Allow user to modify or select portions of suggestion  
·   	Apply only confirmed text  
·   	Create version snapshot before applying

·   	Acceptance Criteria:

·   	Partial edits update only selected segments  
·   	Version snapshot is created before applying AI changes  
·   	Undo restores previous state in one action

FR-AI-003 — AI Failure Handling

·   	Description: The system shall handle AI failures without affecting document state.  
·   	Trigger: AI request fails.  
·   	System Behaviour:

·   	Mark request as FAILED  
·   	Return structured error response  
·   	Do not modify document content

·   	Acceptance Criteria:

·   	Error returned within ≤ 5 seconds  
·   	Error codes include AI\_TIMEOUT, AI\_FAILED, QUOTA\_EXCEEDED  
·   	Retry allowed without corrupting document state

FR-AI-004 — Text Summarization

·   	Description: The system shall generate summaries of selected text using AI.  
·   	Trigger: User selects text and invokes Summarize.  
·   	System Behaviour:

·   	Send selected text to AI  
·   	Return summary as suggestion

·   	Acceptance Criteria:

·   	Summary length ≤ 30% of original text  
·   	Not auto-applied  
·   	User must confirm before applying

FR-AI-005 — Text Translation

·   	Description: The system shall translate selected text into a target language.  
·   	Trigger: User selects text and chooses target language.  
·   	System Behaviour:

·   	Send selected text and language parameter to AI  
·   	Return translated text as suggestion

·   	Acceptance Criteria:

·   	Translation preserves meaning of original text  
·   	Output is not auto-applied  
·   	User must confirm before applying

---

## **1.4 Non-Functional Requirements**

### **1.4.1 Latency & Scalability**

**(Owner: Noel)**

NFR-LS-001 — Document Open Latency (Typical Doc)

* \- Description: Opening a document shall be responsive for typical document sizes under normal load.  
* \- Trigger: User opens a document (initial load).  
* \- Expected system behavior: Backend returns document metadata \+ latest content efficiently, without blocking the UI.  
* \- Acceptance criteria:  
  1.   \- For documents \<= 50KB content, p95 end-to-end API latency for GET /documents/:id \<= 300ms (excluding client rendering).  
  2.   \- p99 latency \<= 800ms under normal load.  
  3.   \- If the document is large, the backend may return content in chunks or a content pointer and still return metadata within 300ms.


NFR-LS-002 — Save/Update Latency (REST Persistence)

* \- Description: Saving updates shall complete quickly to support smooth editing and autosave.  
* \- Trigger: Client submits a save/update request (manual save or autosave).  
* \- Expected system behaviour: Backend validates, persists update, returns revision marker, and remains idempotent under retries.  
* \- Acceptance criteria:  
  1.   \- For typical updates \<= 10KB, p95 latency for PUT/PATCH /documents/:id/content \<= 200ms.  
  2.   \- p99 latency \<= 600ms under normal load.  
  3.   \- Idempotent retry (same requestId) returns within p95 \<= 150ms.

NFR-LS-003 — Real-Time Operation Propagation Latency (Collaboration)

* \- Description: Collaboration updates shall propagate fast enough to feel real-time.  
* \- Trigger: A user submits an edit operation during an active session.  
* \- Expected system behaviour: The sync layer broadcasts operations/presence to connected collaborators promptly.  
* \- Acceptance criteria:  
  1.   \- Under normal network conditions, p95 remote edit propagation \<= 200ms.  
  2.   \- Presence/cursor updates p95 \<= 250ms.  
  3.   \- Revert event propagation to active collaborators \<= 1s.


NFR-LS-004 — Version History Retrieval Latency

* \- Description: Viewing version history shall be responsive even with moderate version counts.  
* \- Trigger: User requests version history.  
* \- Expected system behaviour: Backend returns paginated version metadata without heavy payloads by default.  
* \- Acceptance criteria:  
  1.   \- For \<= 200 versions, p95 latency for GET /documents/:id/versions \<= 300ms.  
  2.   \- For \> 200 versions, pagination must keep p95 \<= 300ms per page (limit \<= 50).  
  3.   \- Default response excludes full version content.


NFR-LS-005 — AI Request Responsiveness (Perceived Latency)

* \- Description: AI actions must provide immediate feedback and complete within reasonable time bounds, with async handling for long tasks.  
* \- Trigger: User invokes AI rewrite/summarise.  
* \- Expected system behaviour: Backend validates permissions/quota, starts AI job, returns jobId quickly, and provides status updates.  
* \- Acceptance criteria:  
  1.   \- AI job creation endpoint returns within p95 \<= 500ms with {jobId, statusUrl}.  
  2.   \- For selection-based rewrites (\<= 1,500 characters), p95 job completion \<= 10s.  
  3.   \- For long-document AI tasks, the system uses async jobs and provides progress/status (PENDING/RUNNING/SUCCEEDED/FAILED).




NFR-LS-006 — Scalability: Collaboration Capacity (Per Document)

* \- Description: The system shall support a realistic number of concurrent collaborators without degradation.  
* \- Trigger: Multiple users open and edit the same document.  
* \- Expected system behaviour: Sync layer and backend continue to accept operations and broadcast updates within latency targets.  
* \- Acceptance criteria:  
  1.   \- Support \>= 25 concurrent connected users per document, with \>= 10 simultaneous editors.  
  2.   \- Sustain \>= 50 edit operations/second per document while keeping NFR-LS-003 targets under normal load.  
  3.   \- If capacity limits are reached, the system returns a clear error (e.g., 503 SESSION\_CAPACITY\_REACHED) and does not corrupt state.


NFR-LS-007 — Scalability: System-Wide Concurrency

* \- Description: The system shall scale to multiple active documents and sessions.  
* \- Trigger: Many documents are active in parallel.  
* \- Expected system behaviour: Backend and sync services remain stable under concurrent load.  
* \- Acceptance criteria:  
  1.   \- Support \>= 500 concurrently active documents (open sessions) and \>= 2,000 connected clients (viewers \+ editors) in aggregate.  
  2.   \- Maintain p95 latencies from NFR-LS-001 to NFR-LS-004 under target load assumptions.

NFR-LS-008 — Payload and Rate Limits (Protect Performance and Cost)

* \- Description: The system shall enforce payload limits and rate limits to protect latency and cost.  
* \- Trigger: Client submits large payloads or high-frequency requests.  
* \- Expected system behaviour: Backend rejects or throttles requests exceeding limits; AI endpoints enforce quotas.  
* \- Acceptance criteria:

    \- Max document content payload per REST update \<= 200KB (larger updates require chunking).

    \- Rate limit AI invocations per user (e.g., \<= 20 requests/day or token-based quota).

    \- When exceeded, return 429 QUOTA\_EXCEEDED (AI) or 413 PAYLOAD\_TOO\_LARGE (oversized payloads).

---

### **1.4.2 Security, Availability & Privacy**

**(Owner: Nurtore)**

**NFR-SAP-001 — Data Encryption at Rest and in Transit**

Description: The system shall protect document and user data during storage and transmission.

Trigger: Document content, metadata, permissions, version data, or AI interaction data is stored or transmitted.

Expected system behaviour:

·   	Encrypt all stored sensitive data at rest  
·   	Use secure transport for all client-server and service-to-service communication

Acceptance criteria:

·   	All document content, version data, and AI interaction records are encrypted at rest using AES-256 or equivalent  
·   	All external and internal network communication uses TLS 1.2+  
·   	Unencrypted HTTP requests to protected endpoints are rejected or redirected

**NFR-SAP-002 — Authentication and Authorisation Enforcement**

Description: The system shall prevent unauthorised access to documents, collaboration sessions, and AI features.

Trigger: Any protected API call, real-time session join, version action, export request, or AI invocation.

Expected system behaviour:

·   	Validate authentication before access  
·   	Enforce document-level role permissions server-side

Acceptance criteria:

·   	All protected requests without valid authentication return 401 AUTH\_REQUIRED or AUTH\_FAILED  
·   	Unauthorised actions return 403 PERMISSION\_DENIED with no side effects  
·   	Role restrictions are enforced server-side even if client UI is bypassed

**NFR-SAP-003 — AI Data Minimisation and Third-Party Privacy Control**

Description: The system shall minimise privacy risk when sending content to external AI providers.

Trigger: User invokes AI rewrite, summarise, translate, or restructure action.

Expected system behaviour:

·   	Send only the required text scope to the AI provider  
·   	Exclude unnecessary identity and permission metadata

Acceptance criteria:

·   	By default, only selected text plus minimal surrounding context is sent to the AI service  
·   	Full-document transmission is disallowed unless explicitly required  
·   	No raw passwords, auth tokens, or permission tables are sent  
·   	If AI is disabled, no document content is transmitted externally

**NFR-SAP-004 — AI Interaction Retention and Deletion Policy**

Description: The system shall define clear retention limits for AI interaction records.

Trigger: AI request is created, completed, rejected, or failed.

Expected system behaviour:

·   	Store AI request metadata for audit and tracing  
·   	Retain records only for a limited period

Acceptance criteria:

·   	AI logs retained ≤ 30 days  
·   	Users/admins can delete AI history  
·   	Expired logs are automatically removed  
·   	Deleted logs are no longer accessible

**NFR-SAP-005 — Graceful Degradation During AI Service Failure**

Description: The system shall remain usable when the AI provider is unavailable.

Trigger: AI provider timeout, API error, quota error, or outage.

Expected system behaviour:

·   	Fail only the AI action  
·   	Show clear AI-specific error

Acceptance criteria:

·   	Editing and collaboration remain available  
·   	Errors include AI\_FAILED, AI\_TIMEOUT, or QUOTA\_EXCEEDED  
·   	AI failures do not modify document content  
·   	Failure state shown within 5 seconds

**NFR-SAP-006 — Service Availability Target**

Description: The system shall provide a minimum service availability level.

Trigger: Normal operation over a calendar month.

Expected system behaviour:

·   	Core services remain available except maintenance

Acceptance criteria:

·   	Monthly uptime ≥ 99.5%  
·   	Maintenance excluded from uptime  
·   	AI downtime must not affect core editing availability

**NFR-SAP-007 — Session Resilience Under Partial Failure**

Description: The system shall preserve user work during disruptions.

Trigger: Sync interruption, DB issues, or disconnect.

Expected system behaviour:

·   	Preserve local edits  
·   	Reconnect automatically

Acceptance criteria:

·   	Disconnect detected within 10s  
·   	Local edits queued until reconnect  
·   	Reconnect within 5s  
·   	No acknowledged edits lost

**NFR-SAP-008 — Auditability of Sensitive Actions**

Description: The system shall log security-relevant actions.

Trigger: Login, permission change, export, revert, AI usage, etc.

Expected system behaviour:

·   	Append immutable audit records

Acceptance criteria:

·   	Audit logs exist for all listed actions  
·   	Only admins/owners can access logs  
·   	Standard users cannot access logs  
·   	Logs are immutable

---

### **1.4.3 Usability & Accessibility**

**(Owner: Nurtore)**

**NFR-U-001 — Interface Clarity Under Multi-User Collaboration**

Description: The system shall present a clear and understandable interface when multiple users are editing simultaneously.

Trigger: A document is opened with multiple active collaborators.

Expected system behaviour:

·   	Display presence indicators (user list, cursors, selections) without clutter  
·   	Limit visual noise from overlapping edits and cursors

Acceptance criteria:

·   	Up to 25 concurrent users displayed without UI overlap or unreadable elements  
·   	User list and cursor indicators remain distinguishable at all times  
·   	No UI blocking or freezing due to presence rendering

**NFR-U-002 — AI Suggestion Readability and Interaction**

Description: AI-generated suggestions shall be easy to understand and interact with.

Trigger: AI returns a suggestion (rewrite, summary, etc.).

Expected system behaviour:

·   	Present suggestions in structured format (inline, diff, or side panel)  
·   	Clearly distinguish AI-generated text from original content

Acceptance criteria:

·   	AI suggestions are visually distinguishable within ≤ 200ms of response  
·   	Users can locate accept/reject controls without scrolling more than one viewport  
·   	Suggestion UI does not block ongoing editing

**NFR-U-003 — Responsiveness of Core Editing Interactions**

Description: The system shall provide smooth typing and interaction experience.

Trigger: User performs typing, cursor movement, or selection actions.

Expected system behaviour:

·   	Local edits are reflected instantly in the UI  
·   	No visible lag due to background sync or AI operations

Acceptance criteria:

·   	Local keystroke rendering latency ≤ 50ms  
·   	Cursor movement updates ≤ 100ms  
·   	No frame drops during continuous typing for typical documents (≤ 50KB)

**NFR-U-004 — Usability During Large Document Handling**

Description: The system shall remain usable when handling large documents or many collaborators.

Trigger: User opens a large document (\>100KB or many collaborators).

Expected system behaviour:

·   	Load content progressively or optimise rendering  
·   	Maintain UI responsiveness

Acceptance criteria:

·   	Initial UI becomes interactive within ≤ 1 second  
·   	No UI freeze longer than 500ms during scroll or edit  
·   	Presence indicators degrade gracefully when exceeding limits

**NFR-U-005 — Error Feedback and Recovery Clarity**

Description: The system shall provide clear, actionable feedback for user errors and system failures.

Trigger: User encounters errors (permission denied, AI failure, network issue).

Expected system behaviour:

·   	Display non-blocking, understandable error messages  
·   	Provide clear next steps (retry, request access, etc.)

Acceptance criteria:

·   	Error messages displayed within ≤ 500ms of failure detection  
·   	Messages include cause \+ suggested action  
·   	Errors do not block unrelated actions

**NFR-U-006 — Accessibility Compliance**

Description: The system shall be usable by users with accessibility needs.

Trigger: User interacts with the system using assistive technologies.

Expected system behaviour:

·   	Provide keyboard navigation and screen reader compatibility

Acceptance criteria:

·   	All core actions accessible via keyboard  
·   	UI components include accessible labels  
·   	Color contrast meets WCAG AA standard

**NFR-U-007 — Minimal Cognitive Load for Collaboration and AI Features**

Description: The system shall avoid overwhelming users with excessive information.

Trigger: Multiple events occur (user joins, edits, AI suggestions).

Expected system behaviour:

·   	Prioritise important information  
·   	Avoid stacking multiple intrusive UI elements

Acceptance criteria:

·   	No more than one blocking modal displayed  
·   	Notifications auto-dismiss within ≤ 5 seconds  
·   	Users can continue editing without interruption

---

## **1.5 User Stories**

**(Owners: Leonard Jiang Mingming and Nurtore Arynuruly)**

**US-01 Offline Reconnect**

**User Story**  
As an editor, I want to continue editing offline and automatically sync after reconnecting, so that brief connectivity loss does not disrupt my work.

**Acceptance Criteria**

* The editor enters an “Offline” state within 2 seconds after connectivity loss.  
* Users can continue editing locally while offline.  
* Offline edits:  
  * are queued locally  
  * are immediately reflected in the UI  
* Upon reconnection:  
  * the client automatically reconnects and syncs within 5 seconds  
  * no page refresh is required  
* After sync:  
  * all collaborators see consistent document content  
* Conflict handling:  
  * system displays a “conflict detected” UI  
  * local user changes are preserved (no silent loss)

---

**US-02 Simultaneous Edit Conflict**

**User Story**  
As an editor, I want the system to resolve concurrent edits predictably, so that we don’t overwrite each other’s work.

**Acceptance Criteria**

* For overlapping edits:  
  * both changes are preserved via OT / CRDT-like mechanism  
  * updates propagate to all clients  
* Cursor/presence:  
  * remain visible and stable  
  * no “teleporting cursor” issues  
* Consistency:  
  * all clients converge within 1 second after last keystroke  
* Edge case (unmergeable conflict):  
  * mark region as “needs review”  
  * show diff or both versions  
  * allow manual resolution without losing data

**US-03 AI Partial Accept**

**User Story**  
As an editor, I want to partially accept an AI suggestion, so that I can keep useful parts without applying the entire change.

**Acceptance Criteria**

* AI output is shown as:  
  * suggestion format (tracked changes / diff / side panel)  
  * not auto-applied  
* User can:  
  * accept entire suggestion  
  * accept selected portions only  
* Partial accept creates a new version entry including:  
  * AI request type (rewrite / summarize / translate, etc.)  
  * original text span reference  
  * accepted vs rejected segments  
* Undo:  
  * restores previous state in one action (Ctrl+Z)

**US-04 AI Quota Exceeded**

**User Story**  
As a user, I want clear feedback when my AI quota is exceeded, so that I’m not confused by silent failures.

**Acceptance Criteria**

* When quota is exceeded:  
  * request is rejected with explicit “quota exceeded” error  
  * not a generic error (e.g., 500\)  
* UI displays:  
  * which limit was hit (user / org)  
  * reset timing or next steps (upgrade / request access)  
* Editing:  
  * document remains fully editable  
  * collaboration unaffected  
* System behavior:  
  * event is logged for auditing  
  * no unnecessary document content is stored  
* Retry behavior:  
  * repeated attempts do not consume extra quota (idempotent)

**US-05 Viewer Tries to Edit**

**User Story**  
As a viewer, I want editing actions to be gracefully blocked, so that I understand my permissions.

**Acceptance Criteria**

* When a viewer attempts to edit:  
  * document is not modified  
  * UI shows non-disruptive message (e.g., “View-only access”)  
* Viewer capabilities:  
  * scroll, search, select text  
  * see real-time updates  
  * see presence indicators  
* Security:  
  * edits blocked client-side AND server-side  
* Optional:  
  * “Request access” flow is available  
  * does not expose private collaborator info

**US-06 Share Document with Read-Only Access**

**User Story**  
As an owner or editor, I want to share a document with read-only access, so others can view without editing.

**Acceptance Criteria**

* Sharing:  
  * generate shareable link OR invite specific users  
  * assign view-only permissions  
* View-only users can:  
  * scroll, search, select text  
  * see real-time updates  
  * see presence indicators  
* UI:  
  * clearly indicates “View-only access” mode  
* Restrictions:  
  * editing disabled in UI  
  * edits blocked client-side AND server-side  
* Permissions:  
  * owner/editor can update or revoke access anytime  
* Privacy:  
  * sharing does not expose private collaborator details by default

**US-07 AI Rewrite During Active Collaboration**

**User Story**

As an editor, I want to request an AI rewrite while others are editing the same region, so collaboration is not disrupted.

**Acceptance Criteria**

·   	System captures a snapshot of selected text for AI processing  
·   	Region marked as 'AI pending' (non-blocking)  
·   	Other users can continue editing

On AI response:

·   	If no changes → show suggestion normally  
·   	If changes occurred → show AI conflict view  
·   	Current text vs AI suggestion  
·   	Options: accept, rebase, discard  
·   	No edits are overwritten without user action  
·   	All clients sync within ≤ 1second

**US-08 Revert to Previous Version During Collaboration**

**User Story**

As an editor, I want to revert to a previous version during collaboration, so I can recover from major mistakes safely.

**Acceptance Criteria**

·   	Revert creates a new version (no overwrite)  
·   	All users updated within ≤ 2s

In-progress edits:

·   	Rebased if possible  
·   	Otherwise marked as conflict  
·   	Users see notification: 'Reverted by \[user\]'  
·   	Revert is undoable  
·   	All clients reach consistent state

**US-09 AI Suggestion Rejected**

**User Story**

As an editor, I want to reject AI suggestions, so unwanted changes are not applied.

**Acceptance Criteria**

·   	Reject removes suggestion instantly (≤ 200ms)  
·   	Document content remains unchanged  
·   	Status logged as rejected

Collaboration:

·   	Suggestion disappears for all users  
·   	No impact on undo stack  
·   	No leftover UI artifacts

**US-10 Admin Disables AI Features**

**User Story**

As an admin, I want to disable AI features, so I can control cost and compliance.

**Acceptance Criteria**

·   	Admin can disable AI by: org / role / user  
·   	Backend enforces restriction  
·   	Returns 403 AI\_FEATURE\_DISABLED  
·   	No call to AI provider

UI:

·   	AI features hidden/disabled with explanation

System:

·   	Changes propagate within ≤ 10s  
·   	Editing/collaboration unaffected  
·   	All changes logged (admin ID, timestamp)  
·   	No data sent to AI when disabled 

### **US-11 Create Document**

User Story  
 As an authenticated user, I want to create a new document, so that I can start writing and collaborating.

Acceptance Criteria

* User can click “New Document” and a document is created.  
* The system assigns a unique document ID.  
* The creator becomes the Owner by default.  
* Initial version snapshot is created automatically.  
* Unauthenticated users receive 401 AUTH\_REQUIRED.

### **US-12 Export Document**

User Story  
 As a user with permission, I want to export a document in a supported format, so that I can download or share it externally.

Acceptance Criteria

* User can select export format (e.g., PDF, DOCX, TXT).  
* For small documents, export completes immediately.  
* For large documents, system creates async export job.  
* Unauthorized users receive 403 PERMISSION\_DENIED.  
* Export link expires after configured time.

### **US-13 AI Summarize and Translate**

User Story  
 As an editor, I want to summarize or translate selected text using AI, so that I can quickly shorten content or convert it to another language.

Acceptance Criteria

* User can select text and choose “Summarize” or “Translate.”  
* AI returns result as a suggestion (not auto-applied).  
* User must confirm before applying changes.  
* Summarized text is shorter than original.  
* Translation preserves the meaning of the original text.  
* AI failure returns clear error without modifying the document. 

---

## **1.6 Requirements Traceability Matrix**

**(Owner: Tabina)**

# work \- architecture

**C4 Level 1, System Context Diagram : Tabina**

**C4 Level 2, Container Diagram : Tabina**

## 

## 

## **STEP 5(Nurtore)**

## **AI Integration Deep Design**

1\. Context Scope

·   	Default: selected text only  
·   	Add small surrounding context for coherence  
·   	Full document only for document-level tasks (e.g., restructure)

\[CONFIRM: \+/- 200 words context window\]

2\. Handling Long Documents

·   	Rewrite/translate → selected text only  
·   	Summarise → selected section  
·   	Restructure → outline / chunked sections  
·   	Reject or chunk if input exceeds limits

3\. Prompt Strategy

·   	Use template-based prompts (rewrite, summarise, translate, etc.)  
·   	Backend fills: selected text, task type, optional parameters  
·   	Prompts configurable (not hardcoded)

\[CONFIRM: store prompts in backend config or separate files\]

4\. Model Selection

·   	Use one general-purpose LLM (MVP)  
·   	Same model for all AI tasks  
·   	Future: multiple models per task

5\. Cost Control

·   	Per-user AI quota (e.g., requests/day)  
·   	Limit input size (token control)  
·   	Log AI usage  
·   	Reject when quota exceeded → 429 QUOTA\_EXCEEDED

6\. Collaboration Behavior (Lock vs Reconcile)

·   	Decision: Reconcile (no hard lock)  
·   	Snapshot selected text  
·   	AI runs on snapshot  
·   	Users can still edit  
·   	On return: no changes → normal suggestion  
·   	Changes → conflict view (current vs AI)

\[CONFIRM: no lock approach\]

7\. Suggestion UX

·   	Show as proposal (not auto-applied)  
·   	UI options: accept, reject, edit before apply  
·   	Prefer diff-style or side panel

\[CONFIRM with frontend\]

8\. Undo Behavior

·   	Applying AI \= one undo step  
·   	Undo restores original text  
·   	Reject does not affect document state  
·   	Create version snapshot before applying

9\. AI Completion Handling

·   	Backend returns: jobId, status  
·   	States: PENDING / RUNNING / SUCCEEDED / FAILED  
·   	Frontend shows loading until complete

10\. Polling vs Event

·   	Decision: Polling (MVP)  
·   	Poll every 1–2s until complete  
·   	Stop on success/failure  
·   	Future: event-based (WebSocket) if needed

**API Design (Owner: Noel)**  
**This section specifies REST endpoints, request/response contracts, and a consistent error model. It also defines async job handling for long-running AI and export operations so the frontend can remain responsive.**

**Standard Headers**  
\- Authorization: Bearer \<accessToken\>  
\- Content-Type: application/json

**Standard Error Schema (all non-2xx responses)**  
\- Response body:  
  \- { "error": { "code": "\<CODE\>", "message": "\<HUMAN\_MESSAGE\>", "details": { ...optional... } } }

**Common Error Codes**  
\- AUTH\_REQUIRED, AUTH\_FAILED, AUTH\_EXPIRED  
\- PERMISSION\_DENIED  
\- INVALID\_INPUT  
\- NOT\_FOUND  
\- VERSION\_NOT\_FOUND  
\- PAYLOAD\_TOO\_LARGE  
\- AI\_DISABLED, AI\_ROLE\_FORBIDDEN, QUOTA\_EXCEEDED  
\- SESSION\_CAPACITY\_REACHED  
\- INTERNAL\_ERROR

**1\) Documents**

**POST /documents**  
\- Purpose: Create a new document.  
\- Request JSON:  
  \- { "title": "Untitled", "content": "Initial text" }  
\- Response JSON (201):  
  \- { "documentId": "doc\_123", "title": "Untitled", "ownerId": "user\_1", "createdAt": "...", "updatedAt": "...", "currentVersionId": "ver\_1" }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 400 INVALID\_INPUT

**GET /documents/{documentId}**  
\- Purpose: Retrieve document metadata \+ latest content.  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "title": "Untitled", "content": "Latest text", "updatedAt": "...", "currentVersionId": "ver\_7", "role": "editor", "revisionId": "rev\_42" }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED (or 404 NOT\_FOUND if using “hide existence” policy) \[TBD\]  
  \- 404 NOT\_FOUND

**PUT /documents/{documentId}/content**  
\- Purpose: Persist updated content (supports manual save/autosave) with idempotency.  
\- Request JSON:  
  \- { "requestId": "req\_abc123", "content": "New full content", "baseRevisionId": "rev\_41" }  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "updatedAt": "...", "revisionId": "rev\_42" }  
\- Notes:  
  \- baseRevisionId allows detecting stale writes; server may reject if too stale (optional).  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED  
  \- 400 INVALID\_INPUT  
  \- 409 CONFLICT (optional, if baseRevisionId is stale)  
  \- 413 PAYLOAD\_TOO\_LARGE

**2\) Versions**

**GET /documents/{documentId}/versions?limit=50\&cursor=...**  
\- Purpose: List version history (metadata).  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "versions": \[ { "versionId": "ver\_7", "versionNumber": 7, "createdAt": "...", "createdBy": "user\_1", "reason": "auto\_snapshot" } \], "nextCursor": "..." }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED

**POST /documents/{documentId}/revert**  
\- Purpose: Revert document to a previous version (creates a new version).  
\- Request JSON:  
  \- { "targetVersionId": "ver\_3", "requestId": "req\_revert\_001" }  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "currentVersionId": "ver\_8", "revertedFromVersionId": "ver\_3", "updatedAt": "..." }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED  
  \- 404 VERSION\_NOT\_FOUND

**3\) Permissions / Sharing**

**GET /documents/{documentId}/permissions**  
\- Purpose: View collaborators \+ roles (Owner/Admin; optional for Editor).  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "members": \[ { "userId": "user\_1", "role": "owner" }, { "userId": "user\_2", "role": "editor" } \] }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED  
**PUT /documents/{documentId}/permissions**  
\- Purpose: Grant/update a user role.  
\- Request JSON:  
  \- { "targetUserId": "user\_2", "role": "editor", "requestId": "req\_perm\_01" }  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "targetUserId": "user\_2", "role": "editor", "updatedAt": "..." }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED  
  \- 400 INVALID\_INPUT  
**DELETE /documents/{documentId}/permissions/{targetUserId}**  
\- Purpose: Revoke access.  
\- Response JSON (200):  
  \- { "documentId": "doc\_123", "targetUserId": "user\_2", "revoked": true }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 PERMISSION\_DENIED

**Sessions (Real-time join) — endpoint definition**  
**POST /sessions**

\- Purpose: Join a real-time collaboration session for a document.  
\- Request: { "documentId": "doc\_123" }  
\- Response (200): { "sessionId": "sess\_abc123", "wsUrl": "wss://\<realtime\>/ws?sess=sess\_abc123", "role": "viewer|editor|owner" }  
\- Errors: 401 AUTH\_REQUIRED, 403 PERMISSION\_DENIED, 404 NOT\_FOUND  
\- Note: Not implemented in PoC; included for architecture completeness.

**4\) AI (Async Jobs)**

**POST /ai/rewrite**  
\- Purpose: Create an AI rewrite job on a selection or entire document (policy enforced).  
\- Request JSON:  
  \- { "documentId": "doc\_123", "selection": { "start": 10, "end": 42 }, "instruction": "Make this more concise", "requestId": "req\_ai\_01" }  
\- Response JSON (202):  
  \- { "jobId": "aijob\_77", "statusUrl": "/ai/jobs/aijob\_77" }  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 403 AI\_DISABLED / AI\_ROLE\_FORBIDDEN / PERMISSION\_DENIED  
  \- 429 QUOTA\_EXCEEDED  
  \- 400 INVALID\_INPUT

**GET /ai/jobs/{jobId}**  
\- Purpose: Poll AI job status and fetch result.  
\- Response JSON (200):  
  \- { "jobId": "aijob\_77", "status": "SUCCEEDED", "result": { "proposedText": "..." }, "createdAt": "...", "updatedAt": "..." }  
\- Status values:  
  \- PENDING, RUNNING, SUCCEEDED, FAILED  
\- Errors:  
  \- 401 AUTH\_REQUIRED  
  \- 404 NOT\_FOUND

**5\) Export (Async Jobs)**

**POST /documents/{documentId}/export**  
\- Purpose: Export document in a specified format.  
\- Request JSON:  
  \- { "format": "pdf", "requestId": "req\_export\_01" }  
\- Response JSON:  
  \- If fast: 200 { "downloadUrl": "https://...", "expiresAt": "..." }  
  \- If async: 202 { "jobId": "expjob\_10", "statusUrl": "/exports/expjob\_10" }

**GET /exports/{jobId}**  
\- Purpose: Poll export job status.  
\- Response JSON (200):  
  \- { "jobId": "expjob\_10", "status": "SUCCEEDED", "downloadUrl": "https://...", "expiresAt": "..." }

**C4 Level 3 — Backend API Component Diagram (Owner: Noel)**  
**This diagram decomposes the Backend API container into components that implement the REST endpoints, enforce AuthN/AuthZ, persist documents/versions/permissions, and integrate with AI and real-time collaboration services.**  
**![][image1]**

**STEP 3.2 (Noel) — Authentication & Authorization Architecture**

**Summary:**  
**The backend enforces role-based access control (RBAC) on every protected REST endpoint and on real-time edit operations. Client-side UI checks are convenient only; the server is the source of truth. Roles are resolved per (userId, documentId) using a Permission mapping.**

**Roles:**  
**\- Viewer: read-only access to documents.**  
**\- Editor: can modify content and participate in collaboration edits.**  
**\- Owner/Admin: can manage permissions, revert versions, configure AI policy, and perform administrative actions.**

**Role Matrix:**

**![][image2]**

**STEP 4 (Noel ig Nurtore \+ Ming Ming) — Communication Model**  
The system uses a push-based real-time communication model for collaboration and a polling-based model for AI operations (MVP). This hybrid approach balances responsiveness and implementation complexity.

**Real-Time Collaboration Model**

·   	Approach: Push-based synchronization (e.g., WebSocket or equivalent)  
·   	Reason: Enables low-latency updates required for collaborative editing

Behavior:

·   	Client establishes a persistent connection when opening a document  
·   	All edits are sent to the server as operations  
·   	Server processes and broadcasts updates to all clients  
·   	Presence is broadcast in real time

Implications:

·   	Near-instant feedback (≤ 200–500ms)  
·   	Maintains shared document state  
·   	Supports continuous collaboration

**Document Open Flow**

·   	Client requests document via REST API (GET /documents/:id)  
·   	Backend returns content, metadata, and role  
·   	Client establishes real-time connection  
·   	Server adds user to session and sends updates

**Disconnection and Reconnection**

On Disconnect:

·   	Detect connection loss within ≤ 10 seconds  
·   	Local edits stored in queue  
·   	User marked offline

On Reconnect:

·   	Reconnect within ≤ 5 seconds  
·   	Replay pending edits  
·   	Synchronize and resolve conflicts

Result:

·   	No silent data loss  
·   	No manual refresh needed

**AI Communication Model**

Approach: Asynchronous request \+ polling (MVP)

Flow:

·   	Client sends AI request  
·   	Backend validates and creates job  
·   	Returns jobId and status  
·   	Client polls every 1–2 seconds  
·   	States: PENDING / RUNNING / SUCCEEDED / FAILED  
·   	Client receives result on completion

**AI During Collaboration**

·   	AI operates on snapshot of selected text  
·   	Other users continue editing

·   	If no changes → normal suggestion  
·   	If changes → conflict view

Decision:

·   	Reconcile (non-blocking), no locking

**Error Handling and States**

·   	Real-time failures trigger reconnect

·   	AI failures return structured errors  
·   	AI\_FAILED, AI\_TIMEOUT, QUOTA\_EXCEEDED

·   	Collaboration unaffected by AI failures

**Design Summary**

·   	Collaboration: push-based real-time  
·   	AI: async \+ polling  
·   	Reconnection: automatic with queued edits  
·   	AI: snapshot \+ reconcile (no locking)

**STEP 7.1 (Noel contribution) — Data Model (Backend Constraints \+ Relationships)**

**![][image3]**

**Entities:**  
\- User  
\- Document  
\- Version  
\- Permission  
\- AIInteraction

**Relationships:**  
\- User (1) — (many) Document: a user can own many documents; each document has exactly one owner (ownerUserId).  
\- Document (1) — (many) Version: versionNumber increases monotonically per document; versions are immutable once created.  
\- User (many) — (many) Document via Permission: (documentId, userId) must be unique; role ∈ {viewer, editor, owner/admin}.  
\- Document (1) — (many) AIInteraction: stores actionType (rewrite/summarize/translate), status (PENDING/RUNNING/SUCCEEDED/FAILED), selection scope, instruction, and timestamps.

**Backend invariants:**  
\- All document reads/writes require RBAC authorization using Permission mapping.  
\- Revert creates a NEW version (history is not rewritten) and should notify active collaboration sessions with a revert event.  
\- AI requests are policy-gated (aiEnabled, allowedRolesForAI, quota limits) and never auto-apply; applying AI creates a new version snapshot.  
\- AIInteraction should reference baseVersionId (version at request time) and appliedVersionId (if suggestion applied).

**Architecture Decision Records (ADRs) — Noel**

**ADR-001: Real-time collaboration consistency approach (CRDT vs OT)**  
\- Status: Proposed (confirm in meeting)  
\- Context:  
  \- The system requires concurrent editing, offline/reconnect support, and guaranteed convergence (no lost edits).  
  \- The solution must be robust to out-of-order delivery and network disruptions while remaining feasible for a student project.  
**\- Decision:**  
  \- Adopt a CRDT-based collaboration approach using a well-tested library (e.g., Yjs) for convergence at the data-structure level.  
  \- The realtime service acts as a relay and permission gate (reject unauthorized edit ops), while the backend persists periodic snapshots/versions.  
**\- Rationale:**  
  \- CRDTs provide strong eventual consistency and are well-suited for offline-first and reconnect flows.  
  \- A library-backed CRDT reduces correctness risk compared to implementing OT/CRDT from scratch.  
**\- Consequences:**  
  \- Pros:  
    \- Simplifies conflict resolution and convergence guarantees.  
    \- Better offline and reconnect experience.  
  \- Cons:  
    \- Additional metadata overhead; requires careful persistence strategy (snapshotting).  
    \- Must clearly define how versions relate to CRDT state.  
**\- Alternatives considered:**  
  \- OT with server-authoritative transforms: mature pattern but higher implementation complexity and correctness risk.  
  \- Last-write-wins / naive merge: unacceptable due to lost edits and poor user experience.  
\- Open questions (highlight for meeting):  
  \- Final choice confirmation: CRDT vs OT (recommend CRDT).  
  \- Where to persist: store full snapshot vs store operation log vs hybrid.

**ADR-002: API style and long-running operations (async jobs)**  
**\- Status: Accepted (if team agrees)**  
**\- Context:**  
  \- The system requires document CRUD, permissions, versioning, AI operations, and exports.  
  \- AI rewrite/export can take seconds to minutes and cannot block the UI or request threads.  
**\- Decision:**  
  \- Use REST APIs for document/permission/version CRUD.  
  \- Use a push channel (WebSocket) for real-time collaboration events (ops, presence, revert events).  
  \- Model AI and export as asynchronous jobs:  
    \- POST creates a job and returns {jobId, statusUrl}  
    \- GET status endpoint returns PENDING/RUNNING/SUCCEEDED/FAILED with result when ready  
**\- Rationale:**  
  \- REST is simple, testable, and aligns with the PoC requirement (POST /documents, GET /documents/:id).  
  \- Async jobs provide predictable UX and clear error handling for long-running tasks.  
**\- Consequences:**  
  **\- Pros:**  
    \- Clear separation between real-time and CRUD concerns.  
    \- Robust handling of slow AI provider and export tasks.  
  **\- Cons:**  
    \- Requires job persistence and status polling (or optional push notifications).  
**\- Alternatives considered:**  
  \- Polling for real-time collaboration: higher latency and wasteful.  
  \- Synchronous AI calls: poor UX, timeouts likely, hard to scale.  
  \- GraphQL for everything: more complex than needed for the project.

**ADR 004 — AI Model Strategy \- Nurtore**

**Title:**

AI Model Strategy for Writing Assistant

**Status:**

Proposed

**Context:**

The system must support AI-powered rewrite, summarization, and translation features inside a collaborative editor. The AI must be useful, fast enough for interactive workflows, and affordable to operate. The design must also consider privacy, since document content may be sensitive, and must avoid adding unnecessary implementation complexity in the first version of the product.

**Decision:**

Use one general-purpose third-party hosted LLM for the MVP across all AI features, including rewrite, summarization, and translation.

The system will:

·   	use the same model for all supported AI tasks in the first version  
·   	send only selected text plus minimal surrounding context by default  
·   	enforce usage limits through quotas and input-size restrictions  
·   	keep model access behind a backend service so the provider or prompt logic can be changed later without frontend changes

**Consequences:**

**Positive:**

·   	simpler implementation and integration  
·   	faster development for MVP  
·   	easier testing, monitoring, and debugging  
·   	consistent AI behavior across features  
·   	easier quota and cost management

**Negative:**

·   	one model may not be optimal for every task  
·   	translation or summarization quality may be weaker than with specialized models  
·   	reliance on a third-party provider introduces privacy and availability risks  
·   	future scaling may require model routing logic if usage grows

**Alternatives considered:**

1\. 	Multiple specialized models for different tasks

·   	Rejected for MVP because it increases integration complexity, testing effort, and operational overhead.

2\. 	Self-hosted or local open-source models

·   	Rejected because infrastructure, deployment, and maintenance costs are too high for the first version.  
·   	Also increases latency and team workload.

3\. 	Full-document context by default for all AI requests

·   	Rejected because it increases cost, latency, and privacy risk.  
·   	Selected-text scope is more efficient and safer for most user actions.

# **ADR-003: Repository Structure Strategy (Tabina)**

### **Context**

The project consists of multiple logical components:

* Frontend (React Web App)  
* Backend API (Node / Express)  
* Real-Time Service (WebSocket Server)  
* AI Integration Service  
* Shared type definitions and configuration

The team must decide whether to use:

* A monorepo (single repository containing all services)  
* Multiple repositories (one per service)

The decision must consider:

* Team size (4 members)  
* Coordination overhead  
* Shared type definitions (e.g., request/response models)  
* CI/CD simplicity  
* Academic project scope

### **Decision**

Adopt a **monorepo structure** containing:

* /frontend  
* /backend  
* /realtime  
* /ai-service  
* /shared  
* /config  
* /tests

All services will exist in a single repository.

Shared types and configuration will be placed in a /shared directory.

Secrets and environment configuration will be handled via .env files excluded from version control.

### **Consequences**

#### **Pros:**

* Simplifies dependency management.  
* Shared types prevent request/response mismatches.  
* Easier coordination between frontend and backend teams.  
* Single CI/CD pipeline.  
* Easier local development setup.

#### **Cons:**

* Repository becomes larger over time.  
* Requires discipline to avoid tight coupling between services.  
* CI builds may run longer if not properly scoped.

### **Alternatives Considered**

1. **Multi-repository approach**  
   * Separate repositories for frontend, backend, and services.  
   * Pros: Clear separation, independent versioning.  
   * Cons: Higher coordination overhead, shared type duplication, more complex CI/CD.  
   * Rejected due to increased complexity for a small academic team.  
2. **Hybrid approach**  
   * Backend services in one repo, frontend separate.  
   * Rejected due to shared API contract complexity. 

### **7.2 Code Structure & Repository Organization (Owner: Tabina)**

#### **Repository Strategy**

The project follows a **monorepo** structure, where all services are maintained within a single repository. This approach simplifies collaboration, ensures consistency across services, and supports shared type definitions.

collaborative-editor-ai/  
│  
├── frontend/                ( React web application)  
├── backend/                 (Node.js / Express REST API)  
├── realtime/                 (WebSocket server for real-time collaboration)  
├── ai-service/                (AI integration and prompt orchestration)  
├── shared/                     ( Shared types, interfaces, and utilities)  
├── config/                      ( Environment configurations and constants)  
├── docs/  
│   ├── adr/                    (Architecture Decision Records)  
│   ├── architecture/   (Architecture documentation)  
│   └── diagrams/         (C4 and ER diagrams)  
│  
├── .gitignore  
├── .nvmrc  
└── README.md

#### **Monorepo Justification**

The monorepo was selected based on the following considerations:

| Factor | Rationale |
| ----- | ----- |
| Team Size | A single repository simplifies coordination among four members. |
| Shared Types | Ensures consistent request/response models across services. |
| CI/CD Simplicity | Enables a unified build and testing pipeline. |
| Academic Scope | Reduces overhead and complexity for an academic project. |
| Development Efficiency | Simplifies local setup and dependency management. |

#### **Shared Folder Strategy**

The /shared directory contains:

* Type definitions for API contracts  
* Validation schemas  
* Shared constants and utilities

This ensures consistency between frontend, backend, and AI services.

#### **Configuration and Secrets Management**

* Environment variables are stored in .env files.  
* .env files are excluded from version control using .gitignore.  
* Example configuration files are provided as .env.example.

#### **Testing Strategy**

| Layer | Testing Approach |
| ----- | ----- |
| Backend | Unit and integration tests using Jest |
| API Contracts | Contract tests for endpoint validation |
| Frontend | Component and UI testing |
| Realtime Service | Integration testing for WebSocket events |
| AI Service | Mocked API testing for deterministic results |

### **8\. Feature Decomposition (Owner: Tabina)**

This section describes how system responsibilities are distributed across architectural modules.

#### **Frontend Module (React Web App)**

**Responsibilities:**

* Provides the user interface for editing and collaboration.  
* Sends REST requests to the Backend API.  
* Establishes WebSocket connections for real-time collaboration.  
* Displays AI-generated suggestions.  
* Handles authentication tokens and session management.

**Dependencies:**

* Backend API  
* Real-Time Service  
* AI Integration Service  
* Identity Provider

#### **Backend Module (Node.js / Express)**

**Responsibilities:**

* Handles document CRUD operations.  
* Enforces authentication and authorization.  
* Manages version control and permissions.  
* Coordinates AI requests.  
* Serves as the central orchestrator of system logic.

**Dependencies:**

* PostgreSQL Database  
* AI Integration Service  
* Real-Time Service  
* Identity Provider

#### 

#### 

#### **Real-Time Sync Layer (WebSocket Server)**

**Responsibilities:**

* Synchronizes edits between collaborators.  
* Broadcasts presence, cursor, and selection updates.  
* Ensures document consistency.  
* Manages user collaboration sessions.

**Dependencies:**

* Backend API  
* Frontend Client

#### **AI Integration Service**

**Responsibilities:**

* Sends requests to the external LLM provider.  
* Processes prompts and responses.  
* Enforces AI policies, quotas, and permissions.  
* Returns AI suggestions asynchronously.

**Dependencies:**

* LLM API Provider  
* Backend API

#### **Storage Layer (PostgreSQL Database)**

**Responsibilities:**

* Stores users, documents, versions, permissions, and AI interactions.  
* Maintains data integrity and relationships.  
* Supports audit logging and traceability.

#### 

#### 

#### **External Services**

| Service | Responsibility |
| ----- | ----- |
| Identity Provider | Authenticates users and validates access tokens. |
| LLM API Provider | Provides AI-powered text generation and analysis. |

---

#### **Module Dependency Summary**

| Module | Depends On |
| ----- | ----- |
| Frontend | Backend API, Real-Time Service, AI Integration Service, Identity Provider |
| Backend API | Database, AI Integration Service, Identity Provider, Real-Time Service |
| Real-Time Service | Backend API, Frontend |
| AI Integration Service | Backend API, LLM Provider |
| Database | Backend API |
| Identity Provider | Backend API |
| LLM Provider | AI Integration Service |

# work \- project management

# work \- proof of concept

PoC Implementation Note (Owner: Noel)

1. Backend PoC implements POST /documents and GET /documents/:id; responses match API spec; uses in-memory store for demo.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAnAAAADsCAYAAAD0KJuyAAAybElEQVR4Xu2daZQURb63PWeO79w775eec7/MmTkz+mGc61VRRwfFBQEFlUUWERREQAQRBFkERJBNwRVUEFBcaAEVFBGhcWPrRvZlHEVlZhgVRxFFRGVtaKXz8o++EURGRlZlVGXkUvl7zvmdWDOrKrKofMjqzj7JAQAAAAAAqeIktQMAAAAAACQbCBywyp/+1BBBECSUAABOAIEDVqEP3aNHf0IQBCkqV191o/rxAkCmgcABq0Dg0pGWLVs511zT2tPPc9JJJ3n68uX3v/89K2nfHTp0FPVBgwZ75vIxKm+5padnLFdoO74tUrohgfvxxx9ZAAAQOGAZCFw6wgVtx45/OxUVb4j26tVrnKqqd1mb923b9g/RfuWVV50mTS53jcs5cODQ8RPuflb/1a9+5RlXnwPlt7/9LSt3797j6qf69OlPijovmzZt5trPqFGj2dhHH21zdu7cxepTp05j5fLlK9mcAQMGMlE8cqTGef/9rZ7ngiQvEDgA3EDggFUgcOkIl6F27do5f/zjH5169c72jP/yl79k9bPOqsfCt/n1r3/tkbdf/OIXQrxI4Pr16+95TMrf/vaB6zG+//5HIXC8/8svvxJ1/thU/+STz1gpC5wqd0OHDnP18W3797/DMxdJdiBwALiBwAGrQODSES5bvP7VV1+LOr8Cp87lfSRwM2eWO2eeeZZrDpW/+93vxBU43n/OOed4Hl/ehgRu2bLlrudz8809XI+tbkfhXwGrz4+XJ5/8/1x9fL/q/pBkBgIHgBsIHLAKBA6JI5Cy0gsEDgA3EDhgFQgcgiBhBAIHgBsIHLAKBA5BkDACgQPADQQOWAUChyBIGIHAAeAGAgesAoFDECSMQOAAcAOBA1aBwCEIEkYgcAC4gcABq0Dgoov6dyORYFHXEUlmIHAAuIHAAavgBBldaK2BGXh/picQOADcQOCAVXCCjC4QOHNozb799jvPWiLJCwQOADcQOGAVCFx0gcCZE5fA/XXLViRA5DWDwAHgBgIHrAKBiy4QOHPiEjgQDDo2e/bsZWsGgQPADQQOWAUCF10gcOZA4JINBA4AfyBwwCoQOHspKytztXMJ3OmneceGDB7HSnXsyJGjzv79B1h98MAxrrFbbr5T1NXtwoL2y0NULF7qGSPOrdfU6d51IGvv2PGFazvK1g+2iW0eeWi62IdMFAKn+7usIBgQOAD8gcABq0Dg7IXEQJaDXALHuX/8FFEnsbmmRVdWXtWsk3Njp9tZPwkc9dXW1jKB63bTADH/z2c3Y3WSJ1ngaE79865m9d2797CxDRveY+3R9zzMSuo7+8zLWfn4Y8+IbXXQnAH9RzkVi5ayOu2TaHNNd888uSSqq4+Ivgb1W4l+HVEJnHqsQDAgcAD4A4EDVoHAmUc+4QcNbecncCRiJDPj733cJXDqFTheksDxtnwFrnevYb5X4Kgu7+exSU+72ocOHna1KXu/+561B94xmkVGnls+c55oc4Hbv/+gZx7HRODUdbSd7ds/YccKBAMCB4A/EDhgFQicvZAQyG0/gXtiykxX+cCEJ8TY9GnPOzOemuMaJ+HjrFi+WtS3fbzdefONFaxOIqfut9ctQ1i5bOkqVr79ViUr6UoazeHziOuu7SXqKrKM8ecyZtQjrHzt1Tc8c848vTEr+WMcO3bM9VjnnNVU1FWiugKn9vlBr+uNJctFe8L4ySKcu4ffz8qWzW9iJQnO+vV/dcbf97hrG6JL537HH6/GuXfso6xvy+YP6nZynBtvqLviSut1U+f+ol8Hl27i2ja3iD655MhtEvd7Rjwk2vw5Tpv6vLPo9XfEfyi4dKtA4ADwBwIHrAKBM8v27f/y9AWNn8ABf6IQOF1yIQuQKkdEl079RJ3GP/nkc2m0jtYtu4k6zTmiCBLfL8kRXXGtqakRY+1a93Datekh2lzeZIlbu2aza1yG2pMff5bV33m7yjWm8tT02WqXCwgcAP5A4IBVIHBmgcBFSxIFTpYaLkdffPGV6MsncDqhUpH7VIHTcdEFrcQ2/OcYCfnrbY7cbnb59dKIHnV7GQgcAP5A4IBVIHBmgcBFSxIFLktMuG+yc+jQYbVbAIEDwB8IHLAKBM4sELho0QncKaec6rlFS9gBwYDAAeAPBA5YBQJnFghctOgETvdLB2EHBAMCB4A/EDhgFQicWYoVOMQ8qsAtW7bcs7ZhBwQDAgeAPxA4YBU6QaonL8Q/xQgcD530ELPI6xfGMcgXEAw6NhA4APRA4IBVIHBmiUIekNyJ4hiAYEDgAPAHAgesAoEzSxTygOROFMdg3LhHnZEjH0LyBAIHgD8QOGAVCJxZopAHJHeiOgbq17iIPhA4APRA4IBVIHBmiUoeEP/gGCQzEDgA3EDggFUgcGaBPMQfHINkBgIHgBsIHLAKBM4skIf4g2OQzEDgAHADgQNWgcCZBfIQf3AMkhkIHABuIHDAKhA4s0Ae4g+OQTIDgQPADQQOWAUCZxbIQ/zBMUhmIHAAuIHAAatA4MySVHnYsmVLbNm58yvP87GZpB6DrAcCV1qof9IOyZ/58ytcawiBA1ahN536QYz4J6nyoEoV5awzmnj6TDPi7vGePjVRCxySzEDgSgs6NwAz5s173ampqRFtCBywCgTOLEkWuM439HGGDRknxIoL3NlnXu6cflpDFj62bNlKUb+y6fXOihWVnjm03cUXtmL14XfdJ8Zu7NTHeWPJW6IdpcCddNJJnj4kGYHAlRYQOHNmz37F9f6HwAGrQODM4idwZWVlTC7iComUKmDyFbhxYx927hl5v2dOZeUq7bY8dAVuwn2Pesapr3zmi6yve/funudjK+q6I8kJBK60gMCZA4EDkQKBM4tO4Pr3v8PTF3VIqjpc29OZ/PgMIV7Pl7/E6rf3ucvZvHkzq898bo5TUfGmS9Ju7NRXbCP3d2jf05k3bwGrd+ncV+yPMv+Vhax8+KEpkV6BQ5IbmwInvy+znK1bt6pLYw0InDkQOBApEDiz6AQuCVeG1A/6KNKn91BWQuAQCgTOfiBwyQYCByIFAmcWCJw3EDiEklSBe+ThqZ6+ILlz0GhPn2l0P5ZQTJIqcPxHLPwYNfIhVvI5w4bcJw/7km+/KkHnT50yU+0KBQgciBQInFmSKnAIEnfiEDj5ZzM3bNjoXH1lJ2fa1GdZXpjzMutv1LAdK+8aeq9n24ULK8R86rul+0DR3/G6Xqzv/HOvchrUb+na7q03l4r2tW17iPqUyTOcVs27OOPGPiLm0r75PuV9bNq0ydV+df7rruenS5IFTq7zNq/LAieP39pzqDN71nzX/LGjJ9btSOLrr3ezksYb1G/l2b+OP5/djO3r0KHDrnlzlMe75ebB7BjXO6OJvHlBQOBApEDgzAKBQxB94hA4Lj+6Os+tPe9k5VVNb9COU1atWs3Khpe0FXO6dL7dM4+iPt7VzTq5xkngdHP99kEZM/ohZ+yYhz3z1CRZ4LgUHTx4yDOmXoHjJfHAhCdcbZU331jBSj6HBI5D8qWj43W9RZ0ETmX1uxtZ+c0337Iy1+ObAIEDkQKBMwsEDkH0iUvgeJ6eMcvTp0a+WkZZ+s5yV3v9+g2ebSivS1fPKPQb2Oqcmc+94OmToz4Wf750Je6all2dF194xRk5YoKzdKl7nhxbArdjxw61y1jgOI889KRzeaPrRP9bb65k9SGDx4k+ef6kiU+xWxYRtA7y16s0r+uN/Vn9nberWNnw4rZifOWKNa59UZ2uvPE67au6+ohrnNi86X1W3j1sglOxeJlrrBggcCBSIHBmgcAhiD5xC1y+5BKjuMOlRu1XY0vg+G16ZEwELgrCECzbQOBApEDgzAKBS0bU+8MhpR1VZLKaiooKz9rYCD83ADMgcCBSIHBmgcDFH6x3MpP0K3ClENtX4CorK0UfBM4cCByIFAicWSBw8WfixEmePiT+ZFXggnz1GVZsCpxKUIErf24eK9WvOOfNXSTq6s+9BaHzDX3VLrEfeX9+dQ61n5w+y9NnAwgciBQInFkgcPFHdwyQ+FMqAke/EVpVtUr89RJZ0B55uO43JuV+KvltSGzHlsDpCCpw9Pr37dvv3D9+snPZJe2cc85qyvrpFh46UaK+r7/+1vnhhx9d47KE8VLtIz74YJuo9+41TIx16tiHlSPvfkCMy9v16D44575v7jbIObde3XPn/d/v/cEzLxcQOBApEDiz6OQBAhdtdMcAiT+lInAUfg84yqSJ09jJW53Dk2ss7CRN4FS5kSVHvgJH9O45VNRlgSJqan5ipXyLEPkKXG1trahz+M14+X569riTlTqB47eHUfvVvlYturr65NuRBAECByIFAmcWnTxA4KKN7hgg8aeUBI4y96VXPX0bNmxw1q5d5+mPKkkVOPmqmCpFvJwwfrLvOHHxha09fVS/qlknV/vSi9q42jycsWMmiTrBx95//2On5dVdnDeWLHf18/Lw4WpPP38sef+5gMCBSIHAmUUnD3EIXJPGHdRDmWrU15crumMQZbKG+vr9UmoCl8QkTeCyAMnbp598rnZrgcCBSIHAmUUnDxC44vn22+9Y1NeZxGSNoMfGpsCB6IHAmQOBA5ECgTMLBM4OQSXhlFNO9fRFnawR9NhA4EoLCJw5EDgQKRA4s0Dg7CDfRDRXRo0a7VmLqJM1IHDZBAJnDgQORAoEziwQODsElYQkJGsEPTYQuNICAmcOBA5ECgTOLHEInG7/fgLXp/ddzpKKuj/ObAO6LxL/Q9VhElQSoo5u7XV89um/2dqHiby/YvdfzLZBjw0ErrSgcwNiFggciBR606kfxIh/4hI4ivwXCPwEToZ+e+qKJh1FnRg+bIIYHzRgjNO+bU/Xr833v/0edi8mqu/Y8YXnV/QvvvAaZ8+evWI+8fCDdffJOnq0RvTL+5TrfgSVhKjD117uy8WK5atZSa/1p5/q5sqvW10LtZwz+1Xt2nHkMbo3lrq+cv2alt18x+Q+3t755S5WqgQ9NhC40oMfT8QsHAgcsAoEziwmAldWVub5Ga4wQvsOInDEMzNedLVlgSNkQSifOY/dRZ3fTFOVBw7vp/lUJ4GT+fu2f7naBM2j+X6orzGpobXPxeeffynqshzJfZzt//zUs5YkcBzdth9++A/nwr+0EPP5nKF33uuZq2vL/bxeXX3kuGz+LPpV1DUoNgBkBbzbgVUgcGYxEbiwwk98cp+fwMkndbXOy7/+9cS9pNQTOkUVON0cuS4LnDyXt3X7UQl6lSfq0Lqrv/nqR93atRT1L774StR5Ka+BLHB8TBY43q9r8/nq+sr1ypVrxXaNLr2W9R08eMg1h6M+jkzQYxP0Cpyt/9gg5gF2wQoDq0DgzBJU4Fq3buPpCzN+ApdWgkpCEpIkcolXUOjvSeYi6LEJKnAgOUDi7ILVBVaBwJklqMA1atTI0xdmIHDxJWsEPTYQuPQBgbMLVhdYBQJnFgicHdSvdsKIumZhJWtA4EoX+ncC7IHVBVaBwJkFAmeHoJKQhGSNoMcGApc+IHB2weoCq0DgzAKBs0NQSUhCskbQYwOBSx8QOLtgdYFVIHBmgcDZIagkJCFZI+ixgcClDwicXbC6wCoQOLMkReAo/MRaSlFfY1KjPu8sRF0DNRC49AGBswtWF1gFAmeWJAnc/v0HSy7qa0xq1OedhahroAYClz4gcHbB6gKrQODMkiSBQ5AkBQKXPiBwdsHqAqtA4MwCgUMQfSBw6QMCZxesLrAKBM4sEDgE0QcClz4gcHbB6gKrQODMAoFDEH0gcOkDAmcXrC6wCgTOLBA4BNEHApc+IHB2weoCq0DgzAKBQxB9IHDpAwJnF6wusAoEziwQOATRBwKXPiBwdsHq+vDtt986W7ZsQY6nGCBwZoHAITxffbW7pKO+3nyBwKUPCJxdsLo+QOBOpBggcGaBwCE8F13UWv3nVDIU8rkAgUsfEDi7YHV9MBW4009r6Nx261BPH5Wvzn/dM183T87mzZtd7VWr3vW0y2e+yOrr12/wbE/jfJvXFy7xjJukGAr5oM5yIHAIT6kLXJA/nyUHApc+IHB2wer6UIjAcRHj9XlzF2jlTBe/eVzk5PHXXlvsmT9//sK8+yo0xaAKHLWRE1FPUv373+Hpi0vg1OeapuzZ84Pn9aQtEDh3IHDpAwJnF6yuD8UInJoe3Qd6+uTt5JKyceNGIW6Vlas84+vWrfd9LHUuz5TJMzx9QVMM9EEtfwhTG9Rxw/V9nO+++961PjpZ0/VFJXBp5fPPv/SsbdoCgXMHApc+IHB2ca3u/PkVnv/JlkpMMRW4QkMypvbZyoX1W3j6gqQYaO3lD+FCjkWpQgInn8Tmz39VK2u6Pghcbj777N/GgpC0QODcgcClDwicXTwCV4oUciKKSuDSkGKAwPkjCxx90PHI61VWVuaMGjXaczKDwOUmjQL37LPPudp+Atf/9pGs7NP7LmXEy4svvKZ2uaB9zHxuntqdF7rKXwwQuGwAgbNLZgTO9B89BO5EigEC5w8XuO3bP3EJ3LJly0XUkxiPKno2kuZjlUaBUwXeT+C4PFVVrnPmzV0k2jt2fOF07zrQaXbFDeJHOtRt/Pp5fdrU51l9wn2TXdsQ59Zr6tmP3KavrIn65zX3bKsCgcsGEDi7QOB8gMCdSDFA4PxRv0JVT+B+IbELMq/YpPlYyUKcxtD6+wmcDAlS+cy6K2gkcLyvtrbWNUeuN7q0navNxx96YKprrtzm8155ebFoqwTtI9TXi6Q3ucg3DooDAudDLoFbu3YdK+k2HfQLB+r4qlWr2c+2VVW5b/3Bs6TiLVY++8xszxiFPvTUvmlTn2XluuOPPXPmC+yxn3l6lvPagsWsnz+WfMuQ58vrbjPCx/gvMtBzo235vNWr13oeT04x0D9gusIURApqan5iJf/Q/+D9j7UnAF0fJ9dYLnJtF2Rs3NhJykh+VIGLO0GPFX/NA+8YrYyYk2ttiyGtV+Dkdi6B4+vW4dpeoi4LnLyuBw8eEm0qVYEj6OqZvN2Zpzd2bUNCKI/rysqVa1mdIz8HFVyBKx3Gjh2rdgkgcHbJhMD913+d4gwfPpy90YKmvLzcIzI89MEktytXVrnaXOrWrasTvQH9RzptWnUT4z17DHKaNung2a8u/EOT6iPvniDq6nOoWPymq93p+tu0+6DyzkGjXWPydrqoa2MS+X9q9CHsJwV79/7AygMHDooP/ufLX9aeBKjvgQlTWP2LL75yzeF1+gpI7QtKo0uv1e7z3VUbXG25TgLH682uuN5pUL+VZ64KCdzQocPYz7glIUGP1aOTZoi6/PpaH3+PE9df11v0Eep6ye3LjsvEnj17Wf2jD//hVFcfYfWjR46KOXw+fWWorufUJ2a62pw0CpyaXAKXBtRjJQOBywYQOLsULXCHDh1Wuxhyf65/yFEQ1hU4eh1CasY87BlX53KBa9fmZue8c68UYyRwun3qwk94vN26VVftdrLAqWPyPqiUBU43X00xyEJA8ZMCeg5PTJkpnqvcr6ND+1tZuXLFGu38Lp37efr82hy6UkH4PYegAkdwgctFEq/ABTlWMn5rqVsjouElbX230TH1iXIhdSRwd/S7h9VramrkaR4gcMkGApcNIHB2CSRwlzSo+yD59NPPnZ07v2Z1fpIjUVNPeCp8jC7LN2l0nej75ptvc27bqWMfUZfnqXVeXtGko5gvE5bA2Qo9d109ytBVQrWPpxj++MeLXB/CQaQgK5DAyVe9TKKe3MKI/PUpJc3HCgKXbCBw2QACZ5dAAiejShS/0uYnYcSlF7VhpSprD97/hLN2zWbRJuRxErjGDa8V/epjy6htmaQLXNJTDLT28odwmqUgbIq5AmdL4uSk+Vipwlts1LWJIhA4dyBw6YP+7QB7BBY4WZ542e2mAdorcFS/7da6exT95c9XC4Hr0X2QR+D4fB38CtyggWPYnMcmPc3aQ++817n6ys6s3vmGvqx8+61Kp1Xzm+o2VIDAFZdigMD5E+QKXNeuXT0nMkoUUpHmYxXmFbhct3OxGQicOxC49AGBs0tggUszELjiUgwQOH+CXoHTyRpu5JubMAWO0rp1G0+f7UDg3IHApQ8InF0yLXC53lw2BI6+DqZywYJFrPS7zQhdbaRy8uN1t/3YuHGTa3zDhg2sXLmisq69foOz/njo1iIUdX/FphggcP7orsCpJy2Krh8Cl5uwBe6UU0719EWRQ4eq2eso1aivN1cgcOkj1zkWFE+mBW7gwIFql8CGwHExU+u68HEq+9w2zDVfvQ3I/RMe82wfZooBAueP7gqcTtZ0fRC43JSKwFVXH3UOHDhUslFfb65A4NIHBM4umRa4HTt2qF0CGwInx0/g6EqaOs5/xpC3b+52h2tMFrhNm9xX68JIMegEDjkRVTLmz1/gOXHFKXBpTakIHHIiELj0AYGzCwTOh7AFzk/YKGf9T+NA8+JKMdDaqx/EFPWrlCxHXpft2//lWau4BI6yb98Bz/NNU9TXU2ggcPEHApc+IHB28Qjc2WddUXJJgsClOcXgJ3CIPkkTOKQuELj4A4FLHxA4u2hXl/8jKbWo5BI4EA4QOLNA4JIZCFz8gcClDwicXbSru2/fvpKMCgTOPhA4s0DgkhkIXPyBwKUPCJxdMr26EDj7QODMAoFLZiBw8QcClz4gcHbJ9OpC4OwDgTMLBC6ZgcDFHwhc+oDA2SXTqwuBsw8EziwQuGQmCoF7//2PMx11PdRA4NIHBM4umV5dCJx9IHBmgcAlM1EIHP1bySpBPicgcOkDAmeXTK8uBM4+QT6YkROBwCUzEDi70GvPd98+CFz6gMDZJdOrC4GzDwTOLHEJHB2nUo36WgsJBM4u9NohcKUHBM4umV5dCJx9wjqBZiVxCRzd8LpU2bNnr3Pw4GHPazYJBM4uELjSBAJnl0yvLgTOPhA4s0DgwofEwPQPp6uBwNkFAleaQODskunVhcDZBwJnFghc+CRV4JYtW+5q+wlcn953Of36jlC7faG/p+zH9R1uU7tc0GPdO+4xtTsvDz84Te0yAgJXmkDg7JLp1YXA2QcCZxYIXPgkVeDouMrH1k/gZCGjOm+Pv/dxVn649e+ufiqPHTsm2rf3uZvVr2rayamqXOf07jXMNVfdP6fJZdc5XTr3Y/XV7250Nm18X8ypra11ml1xg5h/4MBBz3NYVbWe1Tu2v9Wpf97VrH7xhdewUgUCV5pA4OyS6dWFwNkHAmeWoALXtWtXT18xsS1wT0yZqXYVzNyXXle7cjJlyhPOU0/NcJ555rmCU1ZW5ukrNlzgaN90DHIJ3Lixj7J6y6u7OK1bdXONDxk8zmncsL3z1y1bWVuWKBItCu8jgRt594NiW+p/dNIMV5vPbVC/peuxVEE7dOiwS+BU+BhnxfI1TvMrb3T1cX7zmz+x46SukZx69S5ypk+fzlJeXo5ElLZt2xYsYoVuB4KR6dWFwNkHAmeWoAJXbNR95hK4FselIQre/9tHalcoJPkK3O7de0Q7l8DJdVWMdAKnypYscOqYKnDEjCfnuOa1uOpG55mnXxRzfvhhn2ucC5y83zH3PMLqHD6mA1fgShMInF0yvboQOPtA4MxiInDUT2JBV+NMw6/+8Ct5uQRuzqxXRZ1OwnNm17UHDRjDymtadnOdnHUn6ksvasPKXV994zuX6jU1Nc6s8ldEm4/v/HKXmEdf58noHk8mqQKnxk/gSoVcxwkCl3zGjh2rduUFAmeXTK8uBM4+EDizmAhcMeECx9u5BE5FFbjt//zUc3Kud0YTUacxLnC8ratzhg0dL+ry+K5du1kJgSs9IHDJBwKXPDK9uhA4+0DgzBKVwKkxEbi0AYFLPhC45AOBSx6ZXl0InH0gcGaBwIUPv9oYJDfdpP/lEAicXSBwyQcClzwyvboQOPtA4MwCgQsfkytwl12mvz0LBM4uELjkA4FLHpleXQicfSBwZoHAhY+JwPkFAmcXCFzygcAlj0yvLgTOPhA4s0DgwsdU4HTHIAqBo/z44372fLMadT3kQODiBQKXPDK9uhA4+0DgzKKTBwhccZAYpEXgqquPOocOVWc26nrIgcDFCwQueWR6dSFw9oHAmUUnD1EIHB2nUk2aBA7xDwQuXiBwySPTqwuBsw+dQNUPYsQ/OnmIQuAo6tdZpRQIXPoDgYsXCFzyyPTqQuDsA4Ezi04eohI4pC66YwCBiz8QuHiJWuC2fbzdadumh+eKul/69hnh7Nt3QN1NSVP46pYAEDj7QODMopMHCFy00R0DCFz8gcDFi22Bk2Xs79v+pQ4HZufOr137KmWCr24JAoGzDwTOLDp5gMBFG90xgMDFHwhcvBQicKeeeqra5ZSXl4v85jd/ikSySlXmIHDAKhA4s+jkAQIXbXTHAAIXfyBw8VKIwBH0+eWXqM/BpSZxEDhgFQicWXTyAIGLNrpjAIGLPxC4eClU4HRwgYsaOh+V0vsn+hVMEBA4+0DgzKKTBwhctNEdgygEbvnyNYmP+pyjDAQuXooRON3VtpNP/o/IrojRLzfQY02ZMrOk3j8QOGAVCJxZdPIAgYs2umOgE7jdu/d4+kyiHteoTmaFEve/ZQhcvOQSOH5FrXHjxtrIX5ty5Pc7FyyeYn6JQd2XDASuhIDA2SfuD/20RScP6okesRvdMdAJXLHHhZ/QeFs92SQNen50T73vvvve81qiCAQuXnIJXD7yCZyOjRveM7uNSN8R7DdQcwGBKyEgcPaBwJlFJw/FigJiFt0x0AkcpWvXrq6TU6GhfeU7ocUNBC7b0Pu0UGhb9Xwbx/sdAldCqG8oED4QOLPo5IGf4JFoEtUxkOWNEscJzQQIXLYpVuB4OHG83yFwJQQEzj4QOLNEJQ+If3THgKJeNQsztP84TmgmQOBAocjvdU4c73cIXAkBgbMPBM4sOnngJ3gkmvTvf4enz0ZkeaPkOqE1uew6tcvF6ad5t+3T+y61qyggcKBQ6H2u3tQ31/vdFhC4EgICZx8InFkgcPEnqvU2ETgOF7W5Ly5k9XferhL9POpcXm/XpoeoU44dO8bKMaMecRrUbynm//MfnxwfqxXbciBwoFD4e12WuCDv97CBwJUQEDj7QODMAoFLTjZt2uIsW7bcWvhJraysjD2e3wnt4guvEXIlCxyJFEd3BU7tG3/v46w8t15Tp7a21nlgwhPOhcfFjbikQWundatu0mwv9PwWLlzkLFpU4XktUeSC+k2dJUuWsFRWViIpCr5CtQMEDlgFAmcWCFx2QsdV/rrW74Qmy9tNnfuxkl+Bu2fEg5458nZyf70zmoh6p+v7uObLc/3AFThQKKq8Efne75yGl7R1tQl1TlAgcCUEBM4+EDizQOCSE7pFSKNGjaxFvipBj+d3QguTqcdPYIQsbE9Ony1P8QUCBwqFv8/lc67f+12VM1Xg/vbeh545fu1du3a7+iFwJQQEzj4QOLNA4OJPVOstyxvF74SWFCBwQP5PRzEh/N7vJF/8PxpE48vai35iVdV6l7A9OW2Wq53rajIEroSAwNkHAmcWCFz8mThxkqfPRvjJjLf9TmhJAQKXbbh4FYIsbpw43u8QuBICAmcfCJxZIHDxR3cMKOpVhDBD+4/jhGYCBC7btG3r/Vm0oPD3uUwc73cIXAkBgbMPBM4sOnngJ3gkmkR1DGifl13WSLTjOKGZAIHLNvn+Fqr6nxK/PPbYY2x+HO93CFwJAYGzDwTOLFHJA+If3THw+1uoYYb+rSQ9ELjskkvg8p1LcQXODhA4YBX6R6p+ECP+0ckDBC7a6I5BFAJHOXjwMJOkJAcCl01yCVw+6F6HKqrQRQEEroSAwNkHAmcWnTxA4KKN7hhEJXBHjtQ4hw8fSXzU5x1FIHDxUozA0baNGzcW0V2RiwIIXAkBgbMPBM4sOnmAwEUb3TGISuAQ/0Dg4qVQgRs4cKCrTX9OS/6ZuCih81EpvX+iXb2EAYGzDwTOLDp5gMBFG90xgMDFHwhcvBQicPkEjY4l//nKtv/3t3rDZPjw+9m+O3XqK947pfT+yb26JQ4Ezj4QOLPo5AECF210xwACF38gcPFiQ+CIn376SRzXxYve9vziDGXChCnO37f9S93U2bjhPfa1qDqfsm3bdpe0leJ7J//qljAQOPtA4MyikwcIXLTRHQMIXPyBwMWLLYGTUWUrrJAkliJmq1tiQODsA4Ezi04eIHDRRncMIHDxBwIXL1EIXD5qa2udY8eOMSGj/Pzzz6ydVcJd3ZQBgbMPBM4sOnlIksB17tzPGTNmYmqiPv8g0R0DCFz8gcDFSxIEDrjJ9OpC4OwDgTOLTh6SJHCzn5+vHuJEw+9dpr6OXNEdAwhc/IHAxQsELnlkenUhcPaBwJlFJw8QuMIpROB0SYrAzZ27KJVRX0chgcDFCwQueWR6dSFw9oHAmQUCFy4LFy5iWbZsed7073+H71onReDo31PaCOszAAIXLxC45JHp1YXA2SesD++sBAIXLqV2BS6tAhfGMYDAxQsELnlkenUhcPaBwJkFAhcuELj4gcCVBhC45JHp1YXA2QcCZxadwO3evcfTF0WeeeY5jzz6CdzRo0ed00+rk4tvd3+njJ5A/pV/uiWAjnferhL1NWs2Ofv27Wf1ffsOHD957xNjnKXvrFK7BGkXOHX9IXAQuDQBgbNLplcXAmcfCJxZdAJHoQ/CuEPPw0/gSN6CCJzMxQ1aizpte269pq62CvV99um/WX3K48+JPmLxonfEPBn1NaQ5tP5pFTj1tSDpSyEUuh0IRqZXFwJnHwicWfwELo7wK3BlZWWiz0/gBg888fWKn8Dt33/Q1a53RhNXOxePPDSdlVzgBt4xmpU60ZMphStwFN72E7g+ve9ikVHXRjcnCOp+TMEVuOwCgbNLplcXAmcfCJxZkiZwap+fwOWiuvqI2hUZaRc4NX4CR3DRkktZvi69qI2od76hrxjb9dU3rm0OHTws6rzcsvkD7X7H3/s4K4lBA8aIugwELrtA4OyS6dWFwNkHAmeWJAmcLoUIXJxkTeC4WB07Vivq8+YuYiUJ3Gef1V3BpLHWrbqxugrf7oLzm7vauZgwfrLvPAhcdoHA2SXTqwuBsw8EziwQuHBRf44nrIwaNdqzNjZCjyW3/QSO5Gnnzq9FnZeyVPErcL17DWNfX/OxAf1HubbZ+sE217a6UpU1tS0Dgcsu9P4F9sj06kLg7AOBMwsELlxsXYF79lnv18vq/DAiSyPt10/g4iafwP3hD3/wvDbT/Od//n+2H8qpp56qTSG3ugD2gMDZJdOrC4GzDwTOLBC4cLElcH5Rr5gVG9rfZZc1Eu2kClwuor4CV15ernYBi+SStFxjoHgyvboQOPtA4MwCgQuXqAVu4sRJnr4wA4HLL3Dq192I3eQ6j9I4sEemVzfXGw+EAwTOLEkXuAv+0sKpf37z1CRqgbN9/CBw+QUOJAcInF0yvboQOPtA4MxiWwDCCJeiNEV9DaaBwBUOBC67QODskunVhcDZBwJnFtsCgBSWJAlcGgOByyYQOLtkenUhcPahD2/1gxjxj20BQApLUgSOsnfvD54rjGmI+jpMA4FLHxA4u2R6dSFw9oHAmSUKAUDMkySBq64+6hw+fCR1UV+HaSBw6QMCZ5dMry4Ezj4QOLNEIQCIeZIkcFkNBC59QODskunVhcDZBwJnFghAMgOBiz8QuPQBgbNLplcXAmcfCJxZIADJTLEC17VrV8/9s5BoE4QtW7ZkNrt27VKXo2iCrjsojEyvLgTOPhA4s/gJABJvihE4OompfYh5ir0CF0QmVKkxzcKFFZ4+SpNG7cXfkFXHismGDRs9fX4564wmnj45ELj0kenVhcDZBwJnFp0AIPEHAhd/ihW4srIytcvDiOHjhWT1umWwc/65VzrPPTvHuenG21kfjW3evJnVG9Rv6Qy/6z6n/+13s/7Zs+Y6gwbc46xcWcWE7Yz/biTkiMYXL37DOe+cZqKP6ncOGu2SKC6ANP/leQtEXRY/qr/++hLnyekznUkTp7HnwwWRPy8qaVzejgTuhTkvi33Mev4l1z4hcOkj06sLgbMPBM4sOgGIMhMmTHWmTikvuRT7PixG4IJui+ROsQJHqF+rqpFlqdkVHVlI4GTRob7Zs+c5Q+8c6xEsPpdvK29H5YV/aeHZF2+vXbvO6XvbMNd8v/DxNWvWesbWrVvPSvU5yFfgGlxQJ3nyvnr27OlZj2Lyww8/qMsPQgYCB6xS7Ikza9EJQJQhgStFir2ZrE7CdMdK16fbFjFPGAKXD1nGeF0WuFH3PMD66CqbLHDt2tws6nSVS96PLElc4Ki9atW7HlHj26nbjhr5gGcOr2/atMnVxwVOtx9elwWOctb/NLZyBQ7YBQIHrAKBM4tOAKIMBC546Cs5utIwf/4CZ9my5SxynYcETu1DzHNB/abOkiVLWCorKz0JA1V6shQIXPqAwAGrQODMAoGzwymnnOcsXLjIIwX5wiVNXSe/6I4frsCFkyBX4OhYFYMqNVkKBC59FPduTzkQOPtA4MyiE4AoU6oCZ+MKnC664weBCydBBA6ALAGBA1aBwJll9+49nr4oA4ErLhA4ewkqcOXl5WoXACUJBA5YBQKX7NBXTqNGjRZtP4GjnwvKx5KK5azct2+/s/SdVaykyJx3zpWsrFi8jJUN6rdyXlvwpjyF0fe24aysrj7CygMHDrJ9ytTU1LDyzTdWsPK99z6Uh11EIXB+X7VC4MIJBA4ANxA4YBUInHnUX8ePKvTYuQSOS5xc5+3a2lrtmAoJnLwfEjgVeVzX987bVaz+4P1PeB5LbXNOPvk/PK837GzatMVzLCkQuHACgQPADQQOWAUCl+xw+eDtXAIn19U2RxY0HfK2fgJH+D2G3K8TOD+iuALnFwhcOIHAAeAGAgesAoFLV/wELu3EKXDyV9RI4YHAAeAGAgesAoFLVyBw4Ua+uokUFwhcaUH/JrOWsIHAAavQm1b9IEaSm1IVuCh+Bk4XdX2RwmNT4NR7omU1W7duVZfGGjaEJunQe7e6ulrtLhgIHLAKBC5dKVWBo/dhHFfgkPASlcDRz1WqYqPL0CF1f0qrkKiPobZzja1fX/ensmwEAmcXCFyIQODsA4FLVyBwSFITlcDd3H0AK/kvzDxf/hJr9+s7nLWXL1vprFu7jgmcLFdqnXL38PGsfc+I+8X43Lmv/t9+X3TeenOpZ9srmnTw7Gve3AXOtKnPsjb93dKrm3VyjXft0o/VFyxY5CxdutzpeF0vsY8Rd48X9Y0bN4lt+t42TOyDBwJnFwhciEDg7AOBS1cgcEhSE5XADblzDCt7dB8oxGfVqtVCfKhs3+4WVn/55ddYu9kVHVnk/cgSRrmj/wjXGIVvowrbn89udly2NnrGKHQFbsOGDaJdVfUum9OxfS/XvAWvLnLtc/DAUezxKire8uyTBwJnFwhciEDg7AOBS1eenP6C07L5TU7z4yfLUgsELt2JU+B4Of6+SaJOV+CqKleJcVWKVCmjK2fqXF5e+JcWYu7ER6a6xtRSFTh1f3QFTu2jq3ryPui5qM+XAoGzCwQuRCBw9oHApS9HjtQw2SnFqK8VSU+CChz98ogpqshkNbYEjv9Sj4yfwHH55HXOmtUbPX1BePutlWqXhxfmLFC7XI/T6NJrWdm4YXvR9/Zbla45e/bsZWXvXsNEnwoELkQgcPaBwCEIEkaCChyh/jZwvqgik9VUVFR41ibs8PNuLoG7udsgUefIAqcTPLW+ZfMHrE4Cx8fat6376ltm3drNrjZHnjfr+VfYn/zr0P5W1/iRI0dFe+OG91gJgYsICJx9IHAIgoQRE4EzRRWZrMb2FTgKx0/gZHQCJ/fL45s2/s3Vv2zpu6wuCxwfk1HbROuW3Vz9kx55irUbXtJW9K1YvoaVBw8eEn0EBC4iIHD2oX+kCIIgYaSUBW7YkHGevqhjU+BU6HiGQVXlOrVL8PFH/xT1qir/eVEBgQsRCFx08A9eBEGQYhM2qsjYyNlnXu506tibXcmZNHEa66M6ZcXySufiC68RfS2u7iy2u+D85s6T02eK24jYjC2B0xGWwKUJeu9C4EICAgcAAEAVGZu57dYhrvawoXVX3lo178JK+ZYkJHPq9jYDgbMLBC5EIHAAAABUkbERfrWNh/dzgeN96rjcr+4z7EDg7AKBCxEIHAAAAFVkshoInF0gcCECgQMAAPDee+8hxwOBswsELkQgcAAAAED0qL9hnIVA4EIEAgcAAADEg/rbxVkIBC4kIHAAAAAASCMQOAAAAACAlAGBAwAAAABIGRA4AAAAAICUAYEDAAAAAEgZEDhgFfXXqJFgAQAAAHIBgQNWgYyYQ2v2888/q90AAACAAAIHrAKBM4fWjO4XBAAAAPgBgQNWgcCZA4EDAACQDwgcsAoEzhwIHAAAgHxA4IBVIHDmQOAAAADkAwIHrBKGwJ1+WkPno4/+yeqjRj6kjJ5g4sNPutq0nY7Dh6ude0Y86Dvuh+n8QoHAAQAAyAcEDlglLIHjJa8/PeMFp8VVN7L6zOfmsX5Z4LZv/8wjXHw+Rx6fPWu+6JP7qX7kyFHP2EMPTPXsPywgcAAAAPIBgUsAW7ZsMU5aCFPgWrXoKq7AvfN2FYs8J5/AyezZs9fVliVxyOB7nRlPzhHtisVLRZ1Cj7ts6aqc+y8GCBwAAIB8ZFrgksKfz24m5EAVNb+khTAELgxsyZYNIHAAAADykXmBO+mk+JeAhIzLG5Xn1msqRI2LHR+/f8JjiZYRWk95TZMicGkCAgcAACAf8dtLAuDSEVdkgVNlTpY4Pj7r+Zc8+0hiCAicORA4AAAA+YDAJYBcssbbdw271yVwSUWWNwICZw4EDgAAQD4gcAmAi5lJ0kJUAkeSW/+85qz+wpwFOb9m1o3xvtXvbnQ6tL/V2bnza+e8c650VlWtd555+kWnVfOblC3sAYEDAACQDwhcAlDlLEjSQlQCJ0MydufgcaL94guvSaN14xecXyd7nLfeXCnGet0yhNUvvaiN6NNJny0gcAAAAPIBgQNWiUvgZOHSCVyXTv1EnaD7yvE2BA4AAEDSgcABq8QhcGkHAgcAACAfEDhgFQicORA4AAAA+YDAAatA4MyBwAEAAMgHBA5YBQJnDgQOAABAPiBwwCoQOHMgcAAAAPIBgQNWgcCZA4EDAACQDwgcsArJCGIeCBwAAIBcQOBAJJCQIGYBAAAA/IDAAQAAAACkjP8FR7bxYbyeCy0AAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,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>

[image3]: <data:image/png;base64,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>