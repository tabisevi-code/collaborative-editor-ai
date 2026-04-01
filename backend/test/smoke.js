const inject = require("light-my-request");

const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");

async function requestJson(client, path, { method = "GET", headers = {}, body } = {}) {
  const normalizedHeaders = { ...headers };
  let payload;

  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!normalizedHeaders["Content-Type"] && !normalizedHeaders["content-type"]) {
      normalizedHeaders["Content-Type"] = "application/json";
    }
  }

  const result = await inject(client, {
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
    json,
  };
}

async function login(client, userId) {
  const result = await requestJson(client, "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { userId },
  });

  if (result.status !== 200) {
    throw new Error(`[smoke] login failed: ${JSON.stringify(result.json)}`);
  }

  return result.json.accessToken;
}

async function runSmoke(client) {
  console.log("[smoke] using in-process app");

  const ownerToken = await login(client, "user_1");
  const editorToken = await login(client, "user_2");

  const createRes = await requestJson(client, "/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    body: { title: "Smoke Test Doc", content: "Hello" },
  });

  if (createRes.status !== 201) {
    throw new Error(`[smoke] create failed: ${JSON.stringify(createRes.json)}`);
  }

  const documentId = createRes.json.documentId;

  const permissionRes = await requestJson(client, `/documents/${documentId}/permissions`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      "Content-Type": "application/json",
    },
    body: {
      requestId: "smoke_perm_1",
      targetUserId: "user_2",
      role: "editor",
    },
  });

  if (permissionRes.status !== 200) {
    throw new Error(`[smoke] permission update failed: ${JSON.stringify(permissionRes.json)}`);
  }

  const updateRes = await requestJson(client, `/documents/${documentId}/content`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${editorToken}`,
      "Content-Type": "application/json",
    },
    body: {
      requestId: "smoke_update_1",
      content: "Hello from editor",
      baseRevisionId: "rev_1",
    },
  });

  if (updateRes.status !== 200) {
    throw new Error(`[smoke] update failed: ${JSON.stringify(updateRes.json)}`);
  }

  const getRes = await requestJson(client, `/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });

  if (getRes.status !== 200 || getRes.json.content !== "Hello from editor") {
    throw new Error(`[smoke] get failed: ${JSON.stringify(getRes.json)}`);
  }

  console.log("[smoke] PASS");
}

async function main() {
  const config = loadConfig({
    ...process.env,
    DATABASE_PATH: ":memory:",
    ALLOW_DEBUG_USER_HEADER: "true",
  });
  const app = createApp(config);
  const client = app;

  try {
    await runSmoke(client);
  } finally {
    app.locals.context.repository.close();
  }
}

main().catch((error) => {
  console.error("[smoke] FAIL", error);
  process.exit(1);
});
