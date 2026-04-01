const assert = require("node:assert/strict");
const test = require("node:test");

const { loadConfig } = require("../src/config");

test("loadConfig defaults AI provider to stub for reliable local demos", () => {
  const config = loadConfig({});
  assert.equal(config.aiProvider, "stub");
});

test("loadConfig rejects unsupported AI providers", () => {
  assert.throws(
    () => loadConfig({ AI_PROVIDER: "mystery" }),
    /AI_PROVIDER must be one of: stub, lmstudio/
  );
});
