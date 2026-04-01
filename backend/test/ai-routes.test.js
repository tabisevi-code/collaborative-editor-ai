const assert = require("node:assert/strict");
const test = require("node:test");
const inject = require("light-my-request");

const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");

let app;

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

  return {
    status: result.statusCode,
    headers: result.headers,
    json: result.payload ? JSON.parse(result.payload) : {},
  };
}

async function loginAs(userId) {
  const result = await requestJson("/auth/login", {
    method: "POST",
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

async function createDocument(token, { title = "AI Doc", content = "Hello world" } = {}) {
  const result = await requestJson("/documents", {
    method: "POST",
    headers: authHeaders(token),
    body: { title, content },
  });

  assert.equal(result.status, 201);
  return result.json;
}

async function waitForJob(token, jobId, predicate) {
  const timeoutAt = Date.now() + 1000;
  while (Date.now() < timeoutAt) {
    const result = await requestJson(`/ai/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (predicate(result.json)) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`job ${jobId} did not reach the expected state in time`);
}

test.before(() => {
  const config = loadConfig({
    ...process.env,
    DATABASE_PATH: ":memory:",
    ALLOW_DEBUG_USER_HEADER: "true",
  });

  app = createApp(config, {
    aiProvider: {
      async generateText(input) {
        if (input.action === "summarize") {
          return { proposedText: "Short summary" };
        }

        if (input.action === "translate") {
          return { proposedText: "Bonjour le monde" };
        }

        return { proposedText: "Rewritten content" };
      },
    },
  });
});

test.after(() => {
  app.locals.context.repository.close();
});

test.beforeEach(() => {
  app.locals.context.repository.resetForTests();
});

test("POST /ai/rewrite returns a pending job snapshot and GET /ai/jobs eventually succeeds", async () => {
  const token = await loginAs("user_1");
  const document = await createDocument(token, { content: "Example world" });

  const createResult = await requestJson("/ai/rewrite", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      documentId: document.documentId,
      selection: { start: 0, end: 7 },
      selectedText: "Example",
      contextBefore: "",
      contextAfter: " world",
      instruction: "Make it more formal",
      baseVersionId: document.currentVersionId,
      requestId: "req_ai_rewrite_1",
    },
  });

  assert.equal(createResult.status, 202);
  assert.match(createResult.json.jobId, /^aijob_/);
  assert.equal(createResult.json.status, "PENDING");
  assert.equal(createResult.json.baseVersionId, document.currentVersionId);
  assert.ok(!Number.isNaN(Date.parse(createResult.json.createdAt)));
  assert.ok(!Number.isNaN(Date.parse(createResult.json.updatedAt)));

  const getResult = await waitForJob(token, createResult.json.jobId, (job) => job.status === "SUCCEEDED");
  assert.equal(getResult.status, 200);
  assert.equal(getResult.json.status, "SUCCEEDED");
  assert.equal(getResult.json.proposedText, "Rewritten content");
  assert.equal(getResult.json.baseVersionId, document.currentVersionId);
});

test("POST /ai/translate returns 400 INVALID_INPUT when targetLanguage is missing", async () => {
  const token = await loginAs("user_1");
  const document = await createDocument(token, { content: "Hello world" });

  const result = await requestJson("/ai/translate", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      documentId: document.documentId,
      selection: { start: 0, end: 5 },
      selectedText: "Hello",
      contextBefore: "",
      contextAfter: " world",
      baseVersionId: document.currentVersionId,
      requestId: "req_ai_translate_missing_target",
    },
  });

  assert.equal(result.status, 400);
  assert.equal(result.json.error.code, "INVALID_INPUT");
});

test("GET /ai/jobs/:jobId returns 404 for unknown job IDs", async () => {
  const token = await loginAs("user_1");
  const result = await requestJson("/ai/jobs/aijob_missing", {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(result.status, 404);
  assert.equal(result.json.error.code, "NOT_FOUND");
});
