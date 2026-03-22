const { createApp } = require("../src/app");
const { loadConfig } = require("../src/config");

async function runSmoke(baseUrl) {
  console.log(`[smoke] using BASE_URL=${baseUrl}`);

  const createRes = await fetch(`${baseUrl}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": "user_1",
    },
    body: JSON.stringify({ title: "Smoke Test Doc", content: "Hello" }),
  });

  const createJson = await createRes.json();
  if (createRes.status !== 201) {
    throw new Error(
      `[smoke] expected 201, got ${createRes.status}: ${JSON.stringify(
        createJson
      )}`
    );
  }

  const requiredCreateFields = [
    "documentId",
    "title",
    "ownerId",
    "createdAt",
    "updatedAt",
    "currentVersionId",
  ];
  for (const f of requiredCreateFields) {
    if (!(f in createJson)) throw new Error(`[smoke] missing field in POST: ${f}`);
  }

  const id = createJson.documentId;

  const getRes = await fetch(`${baseUrl}/documents/${id}`, {
    headers: { "x-user-id": "user_1" },
  });
  const getJson = await getRes.json();

  if (getRes.status !== 200) {
    throw new Error(
      `[smoke] expected 200, got ${getRes.status}: ${JSON.stringify(getJson)}`
    );
  }

  const requiredGetFields = [
    "documentId",
    "title",
    "content",
    "updatedAt",
    "currentVersionId",
    "role",
    "revisionId",
  ];
  for (const f of requiredGetFields) {
    if (!(f in getJson)) throw new Error(`[smoke] missing field in GET: ${f}`);
  }

  console.log("[smoke] PASS");
}

async function startEmbeddedServer() {
  const config = loadConfig(process.env);
  const app = createApp(config);

  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        reject(new Error("failed to resolve embedded server address"));
        return;
      }

      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });

    server.on("error", reject);
  });
}

async function stopServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const externalBaseUrl = process.env.BASE_URL;
  if (externalBaseUrl) {
    await runSmoke(externalBaseUrl);
    return;
  }

  const { server, baseUrl } = await startEmbeddedServer();
  try {
    await runSmoke(baseUrl);
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error("[smoke] FAIL", e);
  process.exit(1);
});
