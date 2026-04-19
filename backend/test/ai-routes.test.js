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

test("POST /ai/jobs/:jobId/feedback records a reject decision for an accessible job", async () => {
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
      requestId: "req_ai_feedback_1",
    },
  });

  assert.equal(createResult.status, 202);

  const feedbackResult = await requestJson(`/ai/jobs/${createResult.json.jobId}/feedback`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      disposition: "rejected",
    },
  });

  assert.equal(feedbackResult.status, 200);
  assert.equal(feedbackResult.json.jobId, createResult.json.jobId);
  assert.equal(feedbackResult.json.disposition, "rejected");

  const auditLog = app.locals.context.repository.db
    .prepare("SELECT action_type, metadata_json FROM audit_logs WHERE action_type = 'ai_job_feedback' ORDER BY created_at DESC LIMIT 1")
    .get();

  assert.equal(auditLog.action_type, "ai_job_feedback");
  assert.equal(JSON.parse(auditLog.metadata_json).disposition, "rejected");
});

test("POST /ai/rewrite/stream persists history and exposes usage for the document", async () => {
  const token = await loginAs("user_1");
  const document = await createDocument(token, { content: "Original selected text" });

  const streamResult = await requestJson("/ai/rewrite/stream", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      documentId: document.documentId,
      selection: { start: 0, end: 22 },
      selectedText: "Original selected text",
      contextBefore: "",
      contextAfter: "",
      instruction: "Make this more concise",
      baseVersionId: document.currentVersionId,
    },
  });

  assert.equal(streamResult.status, 200);
  assert.match(streamResult.text, /event: token/);
  assert.match(streamResult.text, /event: done/);

  const donePayload = JSON.parse(streamResult.text.split("event: done\ndata: ")[1].split("\n\n")[0]);
  assert.match(donePayload.jobId, /^aijob_/);
  assert.equal(donePayload.fullText, "Rewritten content");

  const historyResult = await requestJson(`/documents/${document.documentId}/ai-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(historyResult.status, 200);
  assert.equal(historyResult.json[0].jobId, donePayload.jobId);
  assert.equal(historyResult.json[0].status, "completed");

  const usageResult = await requestJson(`/documents/${document.documentId}/ai-usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(usageResult.status, 200);
  assert.equal(usageResult.json.usedToday, 1);
  assert.equal(usageResult.json.remainingToday, 4);
  assert.equal(usageResult.json.canUseAi, true);
});

test("POST /ai/jobs/:jobId/cancel returns true for an active streamed job and false after completion", async () => {
  const token = await loginAs("user_1");
  const document = await createDocument(token, { content: "Original selected text" });
  const service = app.locals.context.aiService;
  const user = { userId: "user_1", globalRole: "user" };

  const activeStream = service.startRewriteStream(user, {
    documentId: document.documentId,
    selection: { start: 0, end: 22 },
    selectedText: "Original selected text",
    contextBefore: "",
    contextAfter: "",
    instruction: "Make this more concise",
    baseVersionId: document.currentVersionId,
  });

  const cancelActiveResult = await requestJson(`/ai/jobs/${activeStream.jobId}/cancel`, {
    method: "POST",
    headers: authHeaders(token),
  });
  assert.equal(cancelActiveResult.status, 200);
  assert.equal(cancelActiveResult.json.cancelled, true);

  const completedStream = await requestJson("/ai/rewrite/stream", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      documentId: document.documentId,
      selection: { start: 0, end: 22 },
      selectedText: "Original selected text",
      contextBefore: "",
      contextAfter: "",
      instruction: "Make this more concise",
      baseVersionId: document.currentVersionId,
    },
  });

  const completedJobId = JSON.parse(
    completedStream.text.split("event: done\ndata: ")[1].split("\n\n")[0]
  ).jobId;

  const cancelCompletedResult = await requestJson(`/ai/jobs/${completedJobId}/cancel`, {
    method: "POST",
    headers: authHeaders(token),
  });
  assert.equal(cancelCompletedResult.status, 200);
  assert.equal(cancelCompletedResult.json.cancelled, false);
});

test("POST /ai/jobs/:jobId/feedback updates streamed AI history status", async () => {
  const token = await loginAs("user_1");
  const document = await createDocument(token, { content: "Original selected text" });

  const streamResult = await requestJson("/ai/rewrite/stream", {
    method: "POST",
    headers: authHeaders(token),
    body: {
      documentId: document.documentId,
      selection: { start: 0, end: 22 },
      selectedText: "Original selected text",
      contextBefore: "",
      contextAfter: "",
      instruction: "Make this more concise",
      baseVersionId: document.currentVersionId,
    },
  });
  const donePayload = JSON.parse(streamResult.text.split("event: done\ndata: ")[1].split("\n\n")[0]);

  const feedbackResult = await requestJson(`/ai/jobs/${donePayload.jobId}/feedback`, {
    method: "POST",
    headers: authHeaders(token),
    body: {
      disposition: "applied_full",
      appliedText: "Edited output",
      appliedRange: { start: 0, end: 13 },
    },
  });
  assert.equal(feedbackResult.status, 200);

  const historyResult = await requestJson(`/documents/${document.documentId}/ai-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(historyResult.status, 200);
  assert.equal(historyResult.json[0].status, "edited");
});
