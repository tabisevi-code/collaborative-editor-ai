const assert = require("node:assert/strict");
const test = require("node:test");

const { createLmStudioProvider, AiServiceError } = require("../../ai-service/src");

function makeProviderInput(overrides = {}) {
  return {
    action: "rewrite",
    selectedText: "Original sentence",
    contextBefore: "Leading context",
    contextAfter: "Trailing context",
    instruction: "Make it shorter",
    requestId: "req_lm_1",
    ...overrides,
  };
}

test("LM Studio provider sends chat-completions payload and returns proposedText", async () => {
  let capturedRequest;
  const provider = createLmStudioProvider({
    endpoint: "http://localhost:1234/v1/chat/completions",
    model: "test-model",
    timeoutMs: 500,
    fetch: async (url, init) => {
      capturedRequest = { url, init };
      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: "Shorter sentence",
                },
              },
            ],
          };
        },
      };
    },
  });

  const result = await provider.generateText(makeProviderInput());
  const body = JSON.parse(capturedRequest.init.body);

  assert.equal(capturedRequest.url, "http://localhost:1234/v1/chat/completions");
  assert.equal(body.model, "test-model");
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].role, "user");
  assert.match(body.messages[1].content, /Selected text:\nOriginal sentence/);
  assert.equal(result.proposedText, "Shorter sentence");
});

test("LM Studio provider maps rate-limit responses to QUOTA_EXCEEDED", async () => {
  const provider = createLmStudioProvider({
    fetch: async () => ({
      ok: false,
      status: 429,
    }),
  });

  await assert.rejects(
    () => provider.generateText(makeProviderInput()),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.code, "QUOTA_EXCEEDED");
      return true;
    }
  );
});

test("LM Studio provider maps malformed responses to AI_FAILED", async () => {
  const provider = createLmStudioProvider({
    fetch: async () => ({
      ok: true,
      async json() {
        return { choices: [] };
      },
    }),
  });

  await assert.rejects(
    () => provider.generateText(makeProviderInput()),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.code, "AI_FAILED");
      return true;
    }
  );
});

test("LM Studio provider maps aborts to AI_TIMEOUT", async () => {
  const provider = createLmStudioProvider({
    fetch: async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    },
  });

  await assert.rejects(
    () => provider.generateText(makeProviderInput()),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.code, "AI_TIMEOUT");
      return true;
    }
  );
});
