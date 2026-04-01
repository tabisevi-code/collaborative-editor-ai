const assert = require("node:assert/strict");
const test = require("node:test");

const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");
const { resetDocumentsStore } = require("../src/storage/documentsStore");

const CONTRACT_POST_KEYS = [
  "documentId",
  "title",
  "ownerId",
  "createdAt",
  "updatedAt",
  "currentVersionId",
];

const CONTRACT_GET_KEYS = [
  "documentId",
  "title",
  "content",
  "updatedAt",
  "currentVersionId",
  "role",
  "revisionId",
];

let server;
let baseUrl;

function assertExactKeys(obj, expectedKeys, label) {
  assert.deepEqual(
    Object.keys(obj).sort(),
    [...expectedKeys].sort(),
    `${label} keys must match contract`
  );
}

function assertIsoDate(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(!Number.isNaN(Date.parse(value)), `${label} must be ISO-8601`);
}

function assertStandardError(body, expectedCode) {
  assertExactKeys(body, ["error"], "error response");
  assert.equal(typeof body.error.code, "string", "error.code must be string");
  assert.equal(typeof body.error.message, "string", "error.message must be string");
  assert.equal(body.error.code, expectedCode, `expected error.code=${expectedCode}`);
}

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
  });

  const raw = await response.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch (_err) {
    throw new Error(`expected JSON response, got: ${raw}`);
  }

  return {
    status: response.status,
    headers: response.headers,
    json,
  };
}

function closeServer(httpServer) {
  return new Promise((resolve, reject) => {
    httpServer.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

test.before(async () => {
  const config = loadConfig(process.env);
  const app = createApp(config);

  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1");

    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("failed to resolve test server address"));
        return;
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });

    server.once("error", reject);
  });
});

test.after(async () => {
  if (server?.listening) {
    await closeServer(server);
  }
});

test.beforeEach(() => {
  resetDocumentsStore();
});

test("GET /health returns 200 { ok: true }", async () => {
  const result = await requestJson("/health");

  assert.equal(result.status, 200);
  assert.ok(result.headers.get("x-request-id"));
  assert.deepEqual(result.json, { ok: true });
});

test("POST /documents returns exact 201 contract fields", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user_1",
    },
    body: JSON.stringify({ title: "Test Doc", content: "Hello" }),
  });

  assert.equal(result.status, 201);
  assert.ok(result.headers.get("x-request-id"));
  assertExactKeys(result.json, CONTRACT_POST_KEYS, "POST /documents");
  assert.equal(result.json.title, "Test Doc");
  assert.equal(result.json.ownerId, "user_1");
  assert.equal(result.json.currentVersionId, "ver_1");
  assertIsoDate(result.json.createdAt, "createdAt");
  assertIsoDate(result.json.updatedAt, "updatedAt");
});

test("GET /documents/:id returns exact 200 contract fields", async () => {
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user_1",
    },
    body: JSON.stringify({ title: "Doc", content: "Body" }),
  });

  const getResult = await requestJson(`/documents/${createResult.json.documentId}`, {
    headers: { "x-user-id": "user_1" },
  });

  assert.equal(getResult.status, 200);
  assert.ok(getResult.headers.get("x-request-id"));
  assertExactKeys(getResult.json, CONTRACT_GET_KEYS, "GET /documents/:id");
  assert.equal(getResult.json.title, "Doc");
  assert.equal(getResult.json.content, "Body");
  assert.equal(getResult.json.currentVersionId, "ver_1");
  assert.equal(getResult.json.role, "owner");
  assert.equal(getResult.json.revisionId, "rev_1");
  assertIsoDate(getResult.json.updatedAt, "updatedAt");
});

test("POST /documents defaults ownerId to user_poc when x-user-id is missing", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "No Header", content: "Hello" }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.json.ownerId, "user_poc");
});

test("GET /documents/:id returns 404 standard error for unknown document", async () => {
  const result = await requestJson("/documents/doc_missing", {
    headers: { "x-user-id": "user_1" },
  });

  assert.equal(result.status, 404);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "NOT_FOUND");
});

test("POST /documents returns 400 standard error for invalid input", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "", content: "Hello" }),
  });

  assert.equal(result.status, 400);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "INVALID_INPUT");
});

test("POST /documents returns 400 standard error for non-object JSON body", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["not", "an", "object"]),
  });

  assert.equal(result.status, 400);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "INVALID_INPUT");
});

test("POST /documents returns 400 standard error for invalid JSON", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "{\"title\":",
  });

  assert.equal(result.status, 400);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "INVALID_JSON");
});

test("POST /documents returns 413 standard error when content exceeds max size", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "Big", content: "a".repeat(205000) }),
  });

  assert.equal(result.status, 413);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "PAYLOAD_TOO_LARGE");
});

test("Unknown route returns 404 standard error schema", async () => {
  const result = await requestJson("/not-a-real-route");

  assert.equal(result.status, 404);
  assert.ok(result.headers.get("x-request-id"));
  assertStandardError(result.json, "NOT_FOUND");
});
