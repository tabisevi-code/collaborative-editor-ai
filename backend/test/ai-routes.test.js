const assert = require("node:assert/strict");
const test = require("node:test");

const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");
const { resetDocumentsStore } = require("../src/storage/documentsStore");
const { createAiService, resetAiJobsStore } = require("../../ai-service/src");

let server;
let baseUrl;

function createSilentLogger() {
  return {
    info() {},
    error() {},
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

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
  });

  const raw = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    json: JSON.parse(raw),
  };
}

async function waitForJob(jobId, predicate) {
  const timeoutAt = Date.now() + 1000;
  while (Date.now() < timeoutAt) {
    const result = await requestJson(`/ai/jobs/${jobId}`);
    if (predicate(result.json)) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`job ${jobId} did not reach the expected state in time`);
}

test.before(async () => {
  const config = loadConfig(process.env);
  const aiService = createAiService({
    provider: {
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
    logger: createSilentLogger(),
  });
  const app = createApp(config, { aiService });

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
  resetAiJobsStore();
});

test("POST /ai/rewrite returns a pending job snapshot and GET /ai/jobs eventually succeeds", async () => {
  const createResult = await requestJson("/ai/rewrite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user_1",
    },
    body: JSON.stringify({
      documentId: "doc_123",
      selection: { start: 0, end: 7 },
      selectedText: "Example",
      contextBefore: "Hello ",
      contextAfter: " world",
      instruction: "Make it more formal",
      baseVersionId: "ver_10",
    }),
  });

  assert.equal(createResult.status, 202);
  assert.match(createResult.json.jobId, /^aijob_/);
  assert.equal(createResult.json.status, "PENDING");
  assert.equal(createResult.json.baseVersionId, "ver_10");
  assert.ok(!Number.isNaN(Date.parse(createResult.json.createdAt)));
  assert.ok(!Number.isNaN(Date.parse(createResult.json.updatedAt)));

  const getResult = await waitForJob(createResult.json.jobId, (job) => job.status === "SUCCEEDED");
  assert.equal(getResult.status, 200);
  assert.equal(getResult.json.status, "SUCCEEDED");
  assert.equal(getResult.json.proposedText, "Rewritten content");
  assert.equal(getResult.json.baseVersionId, "ver_10");
});

test("POST /ai/translate returns 400 INVALID_INPUT when targetLanguage is missing", async () => {
  const result = await requestJson("/ai/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      documentId: "doc_123",
      selection: { start: 0, end: 5 },
      selectedText: "Hello",
      baseVersionId: "ver_10",
    }),
  });

  assert.equal(result.status, 400);
  assert.equal(result.json.error.code, "INVALID_INPUT");
});

test("GET /ai/jobs/:jobId returns 404 for unknown job IDs", async () => {
  const result = await requestJson("/ai/jobs/aijob_missing");

  assert.equal(result.status, 404);
  assert.equal(result.json.error.code, "NOT_FOUND");
});
