const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createAiService,
  AiServiceError,
  resetAiJobsStore,
} = require("../../ai-service/src");

function makeValidInput(overrides = {}) {
  return {
    documentId: "doc_123",
    action: "rewrite",
    selection: { start: 4, end: 10 },
    instruction: "Make it clearer",
    requestId: "req_123",
    baseVersionId: "ver_7",
    userId: "user_1",
    selectedText: "sample",
    contextBefore: "Before text",
    contextAfter: "After text",
    ...overrides,
  };
}

function createSilentLogger() {
  return {
    info() {},
    error() {},
  };
}

test.beforeEach(() => {
  resetAiJobsStore();
});

test("createAiJob returns a pending job snapshot with stable metadata", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        return { proposedText: "unused" };
      },
    },
    logger: createSilentLogger(),
  });

  const job = await service.createAiJob(makeValidInput());

  assert.match(job.jobId, /^aijob_/);
  assert.equal(job.status, "PENDING");
  assert.equal(job.baseVersionId, "ver_7");
  assert.equal(job.documentId, "doc_123");
  assert.equal(job.action, "rewrite");
  assert.ok(!Number.isNaN(Date.parse(job.createdAt)));
  assert.ok(!Number.isNaN(Date.parse(job.updatedAt)));
});

test("createAiJob rejects malformed input with a consistent AI error", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        return { proposedText: "unused" };
      },
    },
    logger: createSilentLogger(),
  });

  await assert.rejects(
    () =>
      service.createAiJob(
        makeValidInput({
          baseVersionId: "",
        })
      ),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.code, "AI_FAILED");
      assert.match(error.message, /invalid AI job input/);
      assert.ok(Array.isArray(error.details.issues));
      return true;
    }
  );
});

test("runAiJob succeeds for rewrite and only forwards selection plus minimal context", async () => {
  let capturedInput;
  const service = createAiService({
    provider: {
      async generateText(input) {
        capturedInput = input;
        return { proposedText: "Rewritten sample" };
      },
    },
    logger: createSilentLogger(),
  });

  const job = await service.createAiJob(makeValidInput());
  const completedJob = await service.runAiJob(job);

  assert.equal(completedJob.status, "SUCCEEDED");
  assert.equal(completedJob.proposedText, "Rewritten sample");
  assert.equal(completedJob.baseVersionId, "ver_7");
  assert.equal(capturedInput.action, "rewrite");
  assert.equal(capturedInput.selectedText, "sample");
  assert.equal(capturedInput.contextBefore, "Before text");
  assert.equal(capturedInput.contextAfter, "After text");
  assert.equal(capturedInput.instruction, "Make it clearer");
  assert.equal(capturedInput.requestId, "req_123");
  assert.equal("documentId" in capturedInput, false);
  assert.equal("userId" in capturedInput, false);
});

test("runAiJob succeeds for translate and preserves the original baseVersionId", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        return { proposedText: "Bonjour" };
      },
    },
    logger: createSilentLogger(),
  });

  const job = await service.createAiJob(
    makeValidInput({
      action: "translate",
      targetLanguage: "French",
    })
  );
  const completedJob = await service.runAiJob(job.jobId);

  assert.equal(completedJob.status, "SUCCEEDED");
  assert.equal(completedJob.proposedText, "Bonjour");
  assert.equal(completedJob.baseVersionId, "ver_7");
});

test("createAiJob rejects translate requests without targetLanguage", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        return { proposedText: "unused" };
      },
    },
    logger: createSilentLogger(),
  });

  await assert.rejects(
    () =>
      service.createAiJob(
        makeValidInput({
          action: "translate",
          targetLanguage: "",
        })
      ),
    (error) => {
      assert.equal(error.code, "AI_FAILED");
      assert.match(error.message, /invalid AI job input/);
      return true;
    }
  );
});

test("runAiJob maps provider timeout failures to AI_TIMEOUT", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        const error = new Error("timed out");
        error.name = "AbortError";
        throw error;
      },
    },
    logger: createSilentLogger(),
  });

  const job = await service.createAiJob(makeValidInput());
  const failedJob = await service.runAiJob(job);

  assert.equal(failedJob.status, "FAILED");
  assert.equal(failedJob.errorCode, "AI_TIMEOUT");
  assert.match(failedJob.errorMessage, /timed out/i);
});

test("runAiJob preserves upstream policy-style AI errors without inventing new codes", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        throw new AiServiceError("AI_DISABLED", "AI feature disabled by policy");
      },
    },
    logger: createSilentLogger(),
  });

  const job = await service.createAiJob(makeValidInput());
  const failedJob = await service.runAiJob(job);

  assert.equal(failedJob.status, "FAILED");
  assert.equal(failedJob.errorCode, "AI_DISABLED");
  assert.equal(failedJob.errorMessage, "AI feature disabled by policy");
});

test("getAiJobStatus returns null for unknown jobs instead of inventing a custom shape", async () => {
  const service = createAiService({
    provider: {
      async generateText() {
        return { proposedText: "unused" };
      },
    },
    logger: createSilentLogger(),
  });

  const result = await service.getAiJobStatus("aijob_missing");
  assert.equal(result, null);
});
