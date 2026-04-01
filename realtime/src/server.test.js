const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const Database = require("better-sqlite3");
const WebSocket = require("ws");
const Y = require("yjs");
const syncProtocol = require("y-protocols/sync");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");

const { initializeSchema } = require("../../backend/src/db/schema");
const { signSessionToken } = require("../../shared/sessionToken");
const { createRealtimeServer } = require("./server");

const MESSAGE_SYNC = 0;

function encodeSyncStep1(doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return Buffer.from(encoding.toUint8Array(encoder));
}

function encodeSyncUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const handleError = (error) => reject(error);
    ws.once("error", handleError);
    ws.once("open", () => {
      ws.off("error", handleError);
      ws.on("error", () => {
        // Test sockets are terminated aggressively during teardown. Swallowing
        // those transport errors keeps the test focused on collaboration logic.
      });
      resolve(ws);
    });
  });
}

function closeSocket(ws) {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    ws.once("close", () => resolve());
    ws.terminate();
  });
}

function waitForJson(ws, predicate, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("timed out waiting for JSON message"));
    }, timeoutMs);

    function onMessage(raw) {
      const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
      if (!text.startsWith("{")) {
        return;
      }

      const payload = JSON.parse(text);
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

function attachYjsClient(ws) {
  const doc = new Y.Doc();
  const text = doc.getText("content");

  ws.on("message", (raw) => {
    if (!Buffer.isBuffer(raw)) {
      return;
    }

    const decoder = decoding.createDecoder(new Uint8Array(raw));
    const messageType = decoding.readVarUint(decoder);
    if (messageType !== MESSAGE_SYNC) {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, doc, null);
    const reply = encoding.toUint8Array(encoder);
    if (reply.length > 1) {
      ws.send(Buffer.from(reply));
    }
  });

  ws.send(encodeSyncStep1(doc));
  return { doc, text };
}

function waitForText(client, expected, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const initial = client.text.toString();
    if (initial === expected) {
      resolve(initial);
      return;
    }

    const timeout = setTimeout(() => {
      client.doc.off("update", onUpdate);
      reject(new Error(`timed out waiting for text '${expected}', got '${client.text.toString()}'`));
    }, timeoutMs);

    function onUpdate() {
      if (client.text.toString() !== expected) {
        return;
      }

      clearTimeout(timeout);
      client.doc.off("update", onUpdate);
      resolve(expected);
    }

    client.doc.on("update", onUpdate);
  });
}

function createFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "collab-rt-"));
  const databasePath = path.join(tempDir, "app.sqlite");
  const db = new Database(databasePath);
  initializeSchema(db);

  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO documents (
        document_id, title, owner_user_id, content, created_at, updated_at, current_version_id, revision_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run("doc_test", "Realtime Doc", "user_1", "Seed body", now, now, "ver_1", "rev_1");

  db.prepare(
    `
      INSERT INTO document_permissions (document_id, user_id, role, updated_at)
      VALUES (?, ?, ?, ?)
    `
  ).run("doc_test", "user_1", "owner", now);

  db.prepare(
    `
      INSERT INTO document_permissions (document_id, user_id, role, updated_at)
      VALUES (?, ?, ?, ?)
    `
  ).run("doc_test", "user_2", "editor", now);

  db.prepare(
    `
      INSERT INTO document_permissions (document_id, user_id, role, updated_at)
      VALUES (?, ?, ?, ?)
    `
  ).run("doc_test", "admin_1", "viewer", now);

  db.close();

  const secret = "test_realtime_secret";
  const server = createRealtimeServer({
    port: 0,
    databasePath,
    realtimeSharedSecret: secret,
    pollIntervalMs: 50,
  });

  return {
    databasePath,
    secret,
    server,
    async close() {
      await server.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function createToken(secret, userId, role = "editor") {
  return signSessionToken(
    {
      sessionId: `sess_${userId}`,
      documentId: "doc_test",
      userId,
      role,
      exp: Date.now() + 60_000,
    },
    secret
  );
}

test("authenticated clients receive seeded document content", async () => {
  const fixture = createFixture();

  try {
    const token = createToken(fixture.secret, "user_2", "editor");
    const ws = await openSocket(`ws://127.0.0.1:${fixture.server.port}?token=${encodeURIComponent(token)}`);
    const client = attachYjsClient(ws);

    await waitForText(client, "Seed body");
    assert.equal(client.text.toString(), "Seed body");
    await closeSocket(ws);
  } finally {
    await fixture.close();
  }
});

test("editor updates converge across two connected clients", async () => {
  const fixture = createFixture();

  try {
    const wsA = await openSocket(
      `ws://127.0.0.1:${fixture.server.port}?token=${encodeURIComponent(createToken(fixture.secret, "user_1", "owner"))}`
    );
    const wsB = await openSocket(
      `ws://127.0.0.1:${fixture.server.port}?token=${encodeURIComponent(createToken(fixture.secret, "user_2", "editor"))}`
    );

    const clientA = attachYjsClient(wsA);
    const clientB = attachYjsClient(wsB);
    await Promise.all([waitForText(clientA, "Seed body"), waitForText(clientB, "Seed body")]);

    clientA.doc.transact(() => {
      clientA.text.delete(0, clientA.text.length);
      clientA.text.insert(0, "Shared live update");
    }, "local-test");

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, Y.encodeStateAsUpdate(clientA.doc));
    wsA.send(Buffer.from(encoding.toUint8Array(encoder)));

    await waitForText(clientB, "Shared live update");
    assert.equal(clientB.text.toString(), "Shared live update");

    await closeSocket(wsA);
    await closeSocket(wsB);
  } finally {
    await fixture.close();
  }
});

test("viewer updates are rejected while the socket stays connected", async () => {
  const fixture = createFixture();

  try {
    const ws = await openSocket(
      `ws://127.0.0.1:${fixture.server.port}?token=${encodeURIComponent(createToken(fixture.secret, "admin_1", "viewer"))}`
    );
    const client = attachYjsClient(ws);
    await waitForText(client, "Seed body");

    const editorDoc = new Y.Doc();
    editorDoc.getText("content").insert(0, "Viewer should not write");
    ws.send(Buffer.from(encodeSyncUpdate(Y.encodeStateAsUpdate(editorDoc))));

    const errorPayload = await waitForJson(ws, (payload) => payload.type === "error");
    assert.equal(errorPayload.code, "PERMISSION_DENIED");
    assert.equal(ws.readyState, WebSocket.OPEN);

    await closeSocket(ws);
  } finally {
    await fixture.close();
  }
});

test("document_reverted events reset the shared Yjs content", async () => {
  const fixture = createFixture();

  try {
    const ws = await openSocket(
      `ws://127.0.0.1:${fixture.server.port}?token=${encodeURIComponent(createToken(fixture.secret, "user_2", "editor"))}`
    );
    const client = attachYjsClient(ws);
    await waitForText(client, "Seed body");

    const db = new Database(fixture.databasePath);
    const now = new Date().toISOString();
    db.prepare("UPDATE documents SET content = ?, updated_at = ?, revision_id = ?, current_version_id = ? WHERE document_id = ?").run(
      "Reverted content",
      now,
      "rev_2",
      "ver_2",
      "doc_test"
    );
    db.prepare(
      "INSERT INTO realtime_events (event_id, document_id, event_type, payload_json, created_at, delivered_at) VALUES (?, ?, ?, ?, ?, NULL)"
    ).run(
      "rt_test",
      "doc_test",
      "document_reverted",
      JSON.stringify({
        documentId: "doc_test",
        currentVersionId: "ver_2",
        revisionId: "rev_2",
      }),
      now
    );
    db.close();

    await waitForText(client, "Reverted content");
    await closeSocket(ws);
  } finally {
    await fixture.close();
  }
});
