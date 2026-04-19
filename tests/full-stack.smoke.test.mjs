import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const WebSocket = require("../realtime/node_modules/ws");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_DIR = path.join(ROOT_DIR, "backend_fastapi");
const REALTIME_DIR = path.join(ROOT_DIR, "realtime");

function nodeExecutable() {
  return process.execPath;
}

function pythonExecutable() {
  return process.env.PYTHON || "python3";
}

function createManagedProcess({ cwd, command, args, env, label }) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  const appendLogs = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 12000) {
      logs = logs.slice(-12000);
    }
  };

  child.stdout?.on("data", appendLogs);
  child.stderr?.on("data", appendLogs);

  return {
    child,
    label,
    getLogs() {
      return logs;
    },
  };
}

async function stopProcess(processHandle) {
  if (!processHandle || processHandle.child.exitCode !== null) {
    return;
  }

  processHandle.child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    if (processHandle.child.exitCode === null) {
      processHandle.child.kill("SIGKILL");
    }
  }, 2000);

  try {
    await once(processHandle.child, "exit");
  } finally {
    clearTimeout(timeout);
  }
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForHttpReady(url, processHandle, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processHandle.child.exitCode !== null) {
      throw new Error(`${processHandle.label} exited early\n${processHandle.getLogs()}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // wait and retry
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`timed out waiting for ${processHandle.label} at ${url}\n${processHandle.getLogs()}`);
}

async function waitForTcpReady(port, processHandle, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (processHandle.child.exitCode !== null) {
      throw new Error(`${processHandle.label} exited early\n${processHandle.getLogs()}`);
    }

    const connected = await new Promise((resolve) => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });

    if (connected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`timed out waiting for ${processHandle.label} on port ${port}\n${processHandle.getLogs()}`);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function waitForJsonMessage(ws, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timed out waiting for websocket message"));
    }, timeoutMs);

    function onMessage(data, isBinary) {
      if (isBinary) {
        return;
      }

      let payload;
      try {
        payload = JSON.parse(String(data));
      } catch {
        return;
      }

      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(payload);
    }

    ws.on("message", onMessage);
  });
}

async function openWebSocket(url, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, ["collab.realtime.v1", `auth.${token}`]);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

async function closeWebSocket(ws) {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    return;
  }

  ws.close();
  await once(ws, "close");
}

test("root smoke: backend and realtime wire together for login, documents, sessions, and ws control frames", { timeout: 30000 }, async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "collab-root-smoke-"));
  const databasePath = path.join(tempDir, "app.sqlite");
  const databaseUrl = `sqlite:///${databasePath}`;
  const backendPort = await getAvailablePort();
  const realtimePort = await getAvailablePort();
  const realtimeSecret = "root_smoke_secret";
  const jwtSecret = randomBytes(32).toString("hex");
  const jwtRefreshSecret = randomBytes(32).toString("hex");
  const smokeUserId = "smoke_user_1";
  const smokePassword = "demo-pass-123";

  const backend = createManagedProcess({
    cwd: BACKEND_DIR,
    command: pythonExecutable(),
    args: ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
    env: {
      ...process.env,
      FASTAPI_DATABASE_URL: databaseUrl,
      JWT_SECRET_KEY: jwtSecret,
      JWT_REFRESH_SECRET_KEY: jwtRefreshSecret,
      REALTIME_WS_BASE_URL: `ws://127.0.0.1:${realtimePort}/ws`,
      REALTIME_SHARED_SECRET: realtimeSecret,
      AI_STREAM_PROVIDER: "stub",
    },
    label: "backend",
  });

  const realtime = createManagedProcess({
    cwd: REALTIME_DIR,
    command: nodeExecutable(),
    args: ["src/server.js"],
    env: {
      ...process.env,
      REALTIME_PORT: String(realtimePort),
      DATABASE_PATH: databasePath,
      REALTIME_SHARED_SECRET: realtimeSecret,
    },
    label: "realtime",
  });

  let ws;

  try {
    await waitForHttpReady(`http://127.0.0.1:${backendPort}/health`, backend);
    await waitForTcpReady(realtimePort, realtime);

    const registerResponse = await fetch(`http://127.0.0.1:${backendPort}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: smokeUserId, displayName: "Smoke User", password: smokePassword }),
    });
    assert.equal(registerResponse.status, 201);

    const loginResponse = await fetch(`http://127.0.0.1:${backendPort}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: smokeUserId, password: smokePassword }),
    });
    assert.equal(loginResponse.status, 200);
    const loginJson = await parseJsonResponse(loginResponse);
    assert.equal(loginJson.userId, smokeUserId);
    assert.ok(loginJson.accessToken);

    const authHeaders = {
      Authorization: `Bearer ${loginJson.accessToken}`,
      "Content-Type": "application/json",
    };

    const createResponse = await fetch(`http://127.0.0.1:${backendPort}/documents`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "Root Smoke Doc", content: "Hello world" }),
    });
    assert.equal(createResponse.status, 201);
    const createJson = await parseJsonResponse(createResponse);
    assert.ok(createJson.documentId);

    const getResponse = await fetch(
      `http://127.0.0.1:${backendPort}/documents/${encodeURIComponent(createJson.documentId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${loginJson.accessToken}` },
      }
    );
    assert.equal(getResponse.status, 200);
    const getJson = await parseJsonResponse(getResponse);
    assert.equal(getJson.content, "Hello world");

    const sessionResponse = await fetch(`http://127.0.0.1:${backendPort}/sessions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ documentId: createJson.documentId }),
    });
    assert.equal(sessionResponse.status, 200);
    const sessionJson = await parseJsonResponse(sessionResponse);
    assert.equal(sessionJson.role, "owner");
    assert.ok(sessionJson.wsUrl.includes(`127.0.0.1:${realtimePort}`));
    assert.ok(sessionJson.sessionToken);

    ws = await openWebSocket(sessionJson.wsUrl, sessionJson.sessionToken);
    const sessionReady = await waitForJsonMessage(ws, (payload) => payload.type === "session_ready");
    assert.equal(sessionReady.documentId, createJson.documentId);
    assert.equal(sessionReady.role, "owner");

    ws.send(JSON.stringify({ type: "ping" }));
    const pong = await waitForJsonMessage(ws, (payload) => payload.type === "pong");
    assert.deepEqual(pong, { type: "pong" });
  } finally {
    await closeWebSocket(ws);
    await stopProcess(realtime);
    await stopProcess(backend);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
