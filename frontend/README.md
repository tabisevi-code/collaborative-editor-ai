# Frontend PoC

This frontend is a React + TypeScript PoC for the Collaborative Editor AI project.

It intentionally targets the current backend proof of concept only:

- Create a document
- Open an existing document by ID
- View backend metadata and role
- Edit a local unsaved draft when the role permits it

It does not yet implement:

- WebSocket real-time collaboration
- AI polling or suggestion UI
- Save/update document APIs

## Requirements

- Node.js `20+`
- npm `10+`

## Setup

```bash
cd frontend
npm install
```

## Environment

Create a `.env` file inside `frontend/` if you need a custom backend URL:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

If not provided, the app defaults to `http://localhost:3000`.

## Run

Start the backend first:

```bash
cd backend
npm install
npm run dev
```

Then start the frontend:

```bash
cd frontend
npm run dev
```

Open the URL printed by Vite in your browser.

## Test

```bash
cd frontend
npm test
```

## Manual smoke flow

1. Set `User ID` to `user_1`.
2. Create a document with a title and some content.
3. Confirm the app navigates to `/documents/:documentId`.
4. Re-open the same document ID and confirm the role is `owner`.
5. Change `User ID` to a different value and open the same document again.
6. Confirm the role changes to `viewer` and the editor becomes read-only.
7. Stop the backend and confirm the UI shows a clear backend unavailable message.
