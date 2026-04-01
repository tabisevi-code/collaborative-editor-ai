const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { loadEnvFile } = require("../src/lib/loadEnvFile");

test("loadEnvFile loads keys from a .env file without overriding existing env values", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "backend-env-test-"));
  const envFilePath = path.join(tempDir, ".env");

  fs.writeFileSync(
    envFilePath,
    [
      "# backend config",
      "PORT=4100",
      "AI_PROVIDER=lmstudio",
      "AI_PROVIDER_ENDPOINT=http://127.0.0.1:1234/v1/chat/completions",
      'AI_MODEL="lm-studio-model"',
      "AI_TIMEOUT_MS=20000",
      "",
    ].join("\n"),
    "utf8"
  );

  const env = {
    PORT: "9999",
  };

  const result = loadEnvFile(envFilePath, env);

  assert.equal(result.loaded, true);
  assert.deepEqual(result.loadedKeys, [
    "AI_PROVIDER",
    "AI_PROVIDER_ENDPOINT",
    "AI_MODEL",
    "AI_TIMEOUT_MS",
  ]);
  assert.equal(env.PORT, "9999");
  assert.equal(env.AI_PROVIDER, "lmstudio");
  assert.equal(env.AI_PROVIDER_ENDPOINT, "http://127.0.0.1:1234/v1/chat/completions");
  assert.equal(env.AI_MODEL, "lm-studio-model");
  assert.equal(env.AI_TIMEOUT_MS, "20000");
});

test("loadEnvFile returns a no-op result when the file does not exist", () => {
  const env = {};
  const result = loadEnvFile("/tmp/does-not-exist-backend-env-file", env);

  assert.deepEqual(result, {
    loaded: false,
    loadedKeys: [],
  });
  assert.deepEqual(env, {});
});
