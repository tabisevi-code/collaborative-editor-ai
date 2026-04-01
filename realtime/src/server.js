const path = require("path");
const { URL } = require("url");

const Database = require("better-sqlite3");
const { WebSocketServer } = require("ws");
const Y = require("yjs");
const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");

const { initializeSchema } = require("../../backend/src/db/schema");
const { verifySessionToken } = require("../../shared/sessionToken");

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

function nowIso() {
  return new Date().toISOString();
}

/**
 * We keep the room state in memory because this round intentionally limits
 * persistence work to the existing REST save flow owned by `temp/backend`.
 * This makes the collaboration behavior predictable while remaining honest
 * about the current server-restart limitation.
 */
function createRoom(documentId, initialContent) {
  const ydoc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(ydoc);
  const text = ydoc.getText("content");
  if (initialContent) {
    text.insert(0, initialContent);
  }

  return {
    documentId,
    ydoc,
    awareness,
    clients: new Set(),
  };
}

function encodeSyncStep1(doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  return Buffer.from(encoding.toUint8Array(encoder));
}

function encodeSyncStep2(doc, update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  if (update) {
    syncProtocol.writeUpdate(encoder, update);
  } else {
    syncProtocol.writeSyncStep2(encoder, doc);
  }
  return Buffer.from(encoding.toUint8Array(encoder));
}

function encodeAwarenessUpdate(awareness, clientIds) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  const update = awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds);
  encoding.writeVarUint8Array(encoder, update);
  return Buffer.from(encoding.toUint8Array(encoder));
}

function sendJson(ws, payload) {
  if (ws.readyState === ws.constructor.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendBinary(ws, payload) {
  if (ws.readyState === ws.constructor.OPEN) {
    ws.send(payload, { binary: true });
  }
}

function getEffectiveRole(db, documentId, userId) {
  const document = db
    .prepare(
      `
        SELECT d.document_id, d.owner_user_id, p.role
        FROM documents d
        LEFT JOIN document_permissions p
          ON p.document_id = d.document_id
         AND p.user_id = ?
        WHERE d.document_id = ?
      `
    )
    .get(userId, documentId);

  if (!document) {
    return null;
  }

  if (document.owner_user_id === userId) {
    return "owner";
  }

  return document.role || null;
}

function getDocumentContent(db, documentId) {
  const row = db.prepare("SELECT content FROM documents WHERE document_id = ?").get(documentId);
  return row?.content || "";
}

function setDocumentContent(room, nextContent, origin) {
  const text = room.ydoc.getText("content");
  room.ydoc.transact(() => {
    const current = text.toString();
    if (current.length > 0) {
      text.delete(0, current.length);
    }
    if (nextContent.length > 0) {
      text.insert(0, nextContent);
    }
  }, origin);
}

function createRealtimeServer({
  port = Number(process.env.REALTIME_PORT || 3001),
  databasePath = process.env.DATABASE_PATH || path.join(__dirname, "../../backend/data/app.sqlite"),
  realtimeSharedSecret = process.env.REALTIME_SHARED_SECRET || "dev_realtime_secret",
  pollIntervalMs = Number(process.env.EVENT_POLL_INTERVAL_MS || 1200),
} = {}) {
  const db = new Database(databasePath);
  initializeSchema(db);

  const rooms = new Map();
  const clients = new Set();

  function getOrCreateRoom(documentId) {
    let room = rooms.get(documentId);
    if (room) {
      return room;
    }

    room = createRoom(documentId, getDocumentContent(db, documentId));
    room.ydoc.on("update", (update, origin) => {
      const payload = encodeSyncStep2(room.ydoc, update);
      for (const client of room.clients) {
        if (client === origin) {
          continue;
        }
        sendBinary(client.ws, payload);
      }
    });

    room.awareness.on("update", ({ added, updated, removed }, origin) => {
      const changedClientIds = [...added, ...updated, ...removed];
      if (origin?.awarenessClientIds instanceof Set) {
        for (const clientId of added) {
          origin.awarenessClientIds.add(clientId);
        }
        for (const clientId of removed) {
          origin.awarenessClientIds.delete(clientId);
        }
      }

      const payload = encodeAwarenessUpdate(room.awareness, changedClientIds);
      for (const client of room.clients) {
        if (client === origin) {
          continue;
        }
        sendBinary(client.ws, payload);
      }
    });

    rooms.set(documentId, room);
    return room;
  }

  function removeClient(client) {
    clients.delete(client);
    const room = rooms.get(client.documentId);
    if (!room) {
      return;
    }

    room.clients.delete(client);
    if (client.awarenessClientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(room.awareness, [...client.awarenessClientIds], client);
      client.awarenessClientIds.clear();
    }
  }

  function handleSyncMessage(client, decoder) {
    const room = getOrCreateRoom(client.documentId);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === syncProtocol.messageYjsSyncStep1) {
      sendBinary(client.ws, encodeSyncStep2(room.ydoc));
      return;
    }

    if (client.role === "viewer") {
      sendJson(client.ws, {
        type: "error",
        code: "PERMISSION_DENIED",
        message: "Viewers cannot send collaborative document updates.",
      });
      return;
    }

    room.ydoc.transact(() => {
      if (messageType === syncProtocol.messageYjsSyncStep2) {
        syncProtocol.readSyncStep2(decoder, room.ydoc, client);
        return;
      }

      if (messageType === syncProtocol.messageYjsUpdate) {
        syncProtocol.readUpdate(decoder, room.ydoc, client);
      }
    }, client);
  }

  function handleAwarenessMessage(client, decoder) {
    const room = getOrCreateRoom(client.documentId);
    const awarenessUpdate = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, client);
  }

  function processRealtimeEvents() {
    const events = db
      .prepare(
        `
          SELECT event_id, document_id, event_type, payload_json
          FROM realtime_events
          WHERE delivered_at IS NULL
          ORDER BY created_at ASC
        `
      )
      .all();

    if (events.length === 0) {
      return;
    }

    const markDelivered = db.prepare("UPDATE realtime_events SET delivered_at = ? WHERE event_id = ?");
    const timestamp = nowIso();

    for (const event of events) {
      const payload = JSON.parse(event.payload_json);
      const room = rooms.get(event.document_id);

      if (event.event_type === "document_reverted" && room) {
        setDocumentContent(room, getDocumentContent(db, event.document_id), null);
        for (const client of room.clients) {
          sendJson(client.ws, {
            type: "document_reverted",
            documentId: event.document_id,
            currentVersionId: payload.currentVersionId,
            revisionId: payload.revisionId,
          });
        }
      }

      if (event.event_type === "permission_updated") {
        for (const client of clients) {
          if (client.documentId !== event.document_id || client.userId !== payload.targetUserId) {
            continue;
          }

          client.role = payload.role;
          sendJson(client.ws, {
            type: "permission_updated",
            documentId: event.document_id,
            role: payload.role,
          });
        }
      }

      if (event.event_type === "access_revoked") {
        for (const client of [...clients]) {
          if (client.documentId !== event.document_id || client.userId !== payload.targetUserId) {
            continue;
          }

          sendJson(client.ws, {
            type: "access_revoked",
            documentId: event.document_id,
            targetUserId: payload.targetUserId,
          });
          client.ws.close(4403, "Access revoked");
        }
      }

      markDelivered.run(timestamp, event.event_id);
    }
  }

  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws, request) => {
    try {
      const parsed = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const token = parsed.searchParams.get("token");
      const verified = verifySessionToken(token, realtimeSharedSecret);
      const role = getEffectiveRole(db, verified.documentId, verified.userId);

      if (!role) {
        sendJson(ws, {
          type: "error",
          code: "PERMISSION_DENIED",
          message: "You no longer have access to this document.",
        });
        ws.close(4403, "permission denied");
        return;
      }

      const room = getOrCreateRoom(verified.documentId);
      const client = {
        ws,
        sessionId: verified.sessionId,
        documentId: verified.documentId,
        userId: verified.userId,
        role,
        awarenessClientIds: new Set(),
      };

      clients.add(client);
      room.clients.add(client);

      sendJson(ws, {
        type: "session_ready",
        sessionId: verified.sessionId,
        documentId: verified.documentId,
        userId: verified.userId,
        role,
      });

      sendBinary(ws, encodeSyncStep1(room.ydoc));
      if (room.awareness.getStates().size > 0) {
        sendBinary(ws, encodeAwarenessUpdate(room.awareness, [...room.awareness.getStates().keys()]));
      }

      ws.on("message", (incoming, isBinary) => {
        try {
          if (!isBinary) {
            const message = JSON.parse(String(incoming));
            if (message.type === "ping") {
              sendJson(ws, { type: "pong" });
            }
            return;
          }

          const data = new Uint8Array(incoming);
          const decoder = decoding.createDecoder(data);
          const messageType = decoding.readVarUint(decoder);

          if (messageType === MESSAGE_SYNC) {
            handleSyncMessage(client, decoder);
            return;
          }

          if (messageType === MESSAGE_AWARENESS) {
            handleAwarenessMessage(client, decoder);
            return;
          }

          sendJson(ws, {
            type: "error",
            code: "UNSUPPORTED_MESSAGE",
            message: "Unsupported realtime message type.",
          });
        } catch (error) {
          sendJson(ws, {
            type: "error",
            code: "REALTIME_MESSAGE_ERROR",
            message: error instanceof Error ? error.message : "Failed to process realtime frame.",
          });
        }
      });

      ws.on("close", () => {
        removeClient(client);
      });

      ws.on("error", () => {
        removeClient(client);
      });
    } catch (error) {
      sendJson(ws, {
        type: "error",
        code: "AUTH_FAILED",
        message: error instanceof Error ? error.message : "Realtime authentication failed.",
      });
      ws.close(4401, "auth failed");
    }
  });

  const pollTimer = setInterval(processRealtimeEvents, pollIntervalMs);

  return {
    port: wss.address()?.port || port,
    db,
    wss,
    close() {
      clearInterval(pollTimer);
      for (const client of [...clients]) {
        client.ws.terminate();
      }
      return new Promise((resolve) => {
        wss.close(() => {
          db.close();
          resolve();
        });
      });
    },
  };
}

if (require.main === module) {
  const server = createRealtimeServer();
  console.info(
    JSON.stringify({
      scope: "realtime",
      status: "listening",
      port: server.port,
    })
  );
}

module.exports = {
  createRealtimeServer,
};
