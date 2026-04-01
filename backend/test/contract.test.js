const assert = require("node:assert/strict");
const test = require("node:test");
const inject = require("light-my-request");

const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");

let app;

function assertIsoDate(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(!Number.isNaN(Date.parse(value)), `${label} must be ISO-8601`);
}

function assertStandardError(body, expectedCode) {
  assert.equal(typeof body.error.code, "string", "error.code must be string");
  assert.equal(typeof body.error.message, "string", "error.message must be string");
  assert.equal(body.error.code, expectedCode, `expected error.code=${expectedCode}`);
}

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  const normalizedHeaders = { ...headers };
  let payload;

  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!normalizedHeaders["Content-Type"] && !normalizedHeaders["content-type"]) {
      normalizedHeaders["Content-Type"] = "application/json";
    }
  }

  const result = await inject(app, {
    method,
    url: path,
    headers: normalizedHeaders,
    payload,
  });

  let json = {};
  if (result.payload) {
    try {
      json = JSON.parse(result.payload);
    } catch (_error) {
      json = {};
    }
  }

  return {
    status: result.statusCode,
    headers: result.headers,
    json,
    text: result.payload,
  };
}

async function loginAs(userId) {
  const result = await requestJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { userId },
  });

  assert.equal(result.status, 200);
  return result.json.accessToken;
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

test.before(async () => {
  const config = loadConfig({
    ...process.env,
    DATABASE_PATH: ":memory:",
    ALLOW_DEBUG_USER_HEADER: "true",
  });

  app = createApp(config);
});

test.after(async () => {
  app.locals.context.repository.close();
});

test.beforeEach(() => {
  app.locals.context.repository.resetForTests();
});

test("GET /health returns 200 { ok: true }", async () => {
  const result = await requestJson("/health");

  assert.equal(result.status, 200);
  assert.ok(result.headers["x-request-id"]);
  assert.deepEqual(result.json, { ok: true });
});

test("POST /documents requires auth", async () => {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { title: "No Auth", content: "Hello" },
  });

  assert.equal(result.status, 401);
  assertStandardError(result.json, "AUTH_REQUIRED");
});

test("login returns a bearer token", async () => {
  const result = await requestJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { userId: "user_1" },
  });

  assert.equal(result.status, 200);
  assert.equal(result.json.userId, "user_1");
  assert.equal(result.json.accessToken, "token_user_1");
});

test("create and get document returns contract fields", async () => {
  const token = await loginAs("user_1");
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(token),
    body: { title: "Doc", content: "Hello" },
  });

  assert.equal(createResult.status, 201);
  assert.equal(createResult.json.ownerId, "user_1");
  assertIsoDate(createResult.json.createdAt, "createdAt");
  assertIsoDate(createResult.json.updatedAt, "updatedAt");

  const getResult = await requestJson(`/documents/${createResult.json.documentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(getResult.status, 200);
  assert.equal(getResult.json.role, "owner");
  assert.equal(getResult.json.revisionId, "rev_1");
  assert.equal(getResult.json.content, "Hello");
});

test("permission grant creates editor access", async () => {
  const ownerToken = await loginAs("user_1");
  const editorToken = await loginAs("user_2");

  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "Shared", content: "Hello" },
  });

  const documentId = createResult.json.documentId;

  const permissionResult = await requestJson(`/documents/${documentId}/permissions`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_perm_1",
      targetUserId: "user_2",
      role: "editor",
    },
  });

  assert.equal(permissionResult.status, 200);
  assert.equal(permissionResult.json.role, "editor");

  const getResult = await requestJson(`/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${editorToken}` },
  });

  assert.equal(getResult.status, 200);
  assert.equal(getResult.json.role, "editor");
});

test("viewer cannot update content", async () => {
  const ownerToken = await loginAs("user_1");
  const viewerToken = await loginAs("user_2");

  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "Read Only", content: "Hello" },
  });

  const documentId = createResult.json.documentId;

  await requestJson(`/documents/${documentId}/permissions`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_perm_viewer",
      targetUserId: "user_2",
      role: "viewer",
    },
  });

  const updateResult = await requestJson(`/documents/${documentId}/content`, {
    method: "PUT",
    headers: authHeaders(viewerToken),
    body: {
      requestId: "req_update_denied",
      content: "Nope",
      baseRevisionId: "rev_1",
    },
  });

  assert.equal(updateResult.status, 403);
  assertStandardError(updateResult.json, "PERMISSION_DENIED");
});

test("content updates are idempotent and enforce stale revision checks", async () => {
  const ownerToken = await loginAs("user_1");
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "Mutable", content: "Hello" },
  });

  const documentId = createResult.json.documentId;

  const firstUpdate = await requestJson(`/documents/${documentId}/content`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_update_1",
      content: "Hello world",
      baseRevisionId: "rev_1",
    },
  });

  assert.equal(firstUpdate.status, 200);
  assert.equal(firstUpdate.json.revisionId, "rev_2");

  const replayUpdate = await requestJson(`/documents/${documentId}/content`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_update_1",
      content: "Hello world",
      baseRevisionId: "rev_1",
    },
  });

  assert.equal(replayUpdate.status, 200);
  assert.deepEqual(replayUpdate.json, firstUpdate.json);

  const staleUpdate = await requestJson(`/documents/${documentId}/content`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_update_2",
      content: "Stale write",
      baseRevisionId: "rev_1",
    },
  });

  assert.equal(staleUpdate.status, 409);
  assertStandardError(staleUpdate.json, "CONFLICT");
});

test("list versions and revert keep history instead of overwriting it", async () => {
  const ownerToken = await loginAs("user_1");
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "Versions", content: "One" },
  });

  const documentId = createResult.json.documentId;

  await requestJson(`/documents/${documentId}/content`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_update_versions",
      content: "Two",
      baseRevisionId: "rev_1",
    },
  });

  const versionsBeforeRevert = await requestJson(`/documents/${documentId}/versions`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(versionsBeforeRevert.status, 200);
  assert.equal(versionsBeforeRevert.json.versions.length, 2);

  const revertResult = await requestJson(`/documents/${documentId}/revert`, {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: {
      requestId: "req_revert_1",
      targetVersionId: versionsBeforeRevert.json.versions[1].versionId,
    },
  });

  assert.equal(revertResult.status, 200);

  const versionsAfterRevert = await requestJson(`/documents/${documentId}/versions`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(versionsAfterRevert.status, 200);
  assert.equal(versionsAfterRevert.json.versions.length, 4);
});

test("AI policy can disable AI and AI jobs complete asynchronously", async () => {
  const ownerToken = await loginAs("user_1");
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "AI Doc", content: "Hello from AI testing" },
  });

  const documentId = createResult.json.documentId;

  const disabledResult = await requestJson(`/documents/${documentId}/ai-policy`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      aiEnabled: false,
      allowedRolesForAI: ["owner", "editor"],
      dailyQuota: 2,
    },
  });

  assert.equal(disabledResult.status, 200);
  assert.equal(disabledResult.json.aiEnabled, false);

  const blockedAi = await requestJson("/ai/rewrite", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: {
      documentId,
      selection: { start: 0, end: 5 },
      instruction: "Rewrite",
      requestId: "req_ai_disabled",
    },
  });

  assert.equal(blockedAi.status, 403);
  assertStandardError(blockedAi.json, "AI_DISABLED");

  await requestJson(`/documents/${documentId}/ai-policy`, {
    method: "PUT",
    headers: authHeaders(ownerToken),
    body: {
      aiEnabled: true,
      allowedRolesForAI: ["owner", "editor"],
      dailyQuota: 2,
    },
  });

  const aiJobResult = await requestJson("/ai/rewrite", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: {
      documentId,
      selection: { start: 0, end: 5 },
      instruction: "Rewrite",
      requestId: "req_ai_success",
    },
  });

  assert.equal(aiJobResult.status, 202);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const aiStatus = await requestJson(aiJobResult.json.statusUrl, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(aiStatus.status, 200);
  assert.equal(aiStatus.json.status, "SUCCEEDED");
  assert.match(aiStatus.json.result.proposedText, /Rewrite/);
});

test("txt export returns download metadata and sessions issue ws URLs", async () => {
  const ownerToken = await loginAs("user_1");
  const createResult = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { title: "Exportable", content: "Hello export" },
  });

  const documentId = createResult.json.documentId;

  const exportResult = await requestJson(`/documents/${documentId}/export`, {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { format: "txt" },
  });

  assert.equal(exportResult.status, 200);
  assert.match(exportResult.json.downloadUrl, /\/exports\//);

  const downloadResult = await inject(app, {
    method: "GET",
    url: exportResult.json.downloadUrl,
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  assert.equal(downloadResult.statusCode, 200);
  assert.match(downloadResult.payload, /Hello export/);

  const sessionResult = await requestJson("/sessions", {
    method: "POST",
    headers: authHeaders(ownerToken),
    body: { documentId },
  });

  assert.equal(sessionResult.status, 200);
  assert.match(sessionResult.json.wsUrl, /^ws:\/\/localhost:3001\/ws/);
});
