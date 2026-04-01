const path = require("path");
const Database = require("better-sqlite3");
const { WebSocketServer, WebSocket } = require("ws");

const { verifySessionToken } = require("../../shared/sessionToken");

const REALTIME_PORT = Number(process.env.REALTIME_PORT || 3001);
const DATABASE_PATH =
  process.env.DATABASE_PATH ||
  path.resolve(process.cwd(), "..", "backend", "data", "collaborative-editor-ai.sqlite");
const REALTIME_SHARED_SECRET =
  process.env.REALTIME_SHARED_SECRET || "collaborative-editor-ai-dev-secret";
const EVENT_POLL_INTERVAL_MS = Number(process.env.EVENT_POLL_INTERVAL_MS || 1000);

const db = new Database(DATABASE_PATH, { fileMustExist: false });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const rooms = new Map();

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getEffectiveRole(documentId, userId) {
  const row = db
    .prepare(
      `
      SELECT
        d.owner_user_id,
        p.role AS stored_role,
        u.global_role
      FROM documents d
      JOIN users u ON u.user_id = @userId
      LEFT JOIN document_permissions p
        ON p.document_id = d.document_id
       AND p.user_id = @userId
      WHERE d.document_id = @documentId
    `
    )
    .get({ documentId, userId });

  if (!row) {
    return null;
  }

  if (row.global_role === "admin") {
    return row.owner_user_id === userId ? "owner" : "editor";
  }

  if (row.owner_user_id === userId) {
    return "owner";
  }

  return row.stored_role || null;
}

function broadcast(documentId, payload, predicate = () => true) {
  const room = rooms.get(documentId);
  if (!room) {
    return;
  }

  for (const client of room) {
    if (predicate(client)) {
      sendJson(client.ws, payload);
    }
  }
}

function addClient(client) {
  const room = rooms.get(client.documentId) || new Set();
  room.add(client);
  rooms.set(client.documentId, room);
}

function removeClient(client) {
  const room = rooms.get(client.documentId);
  if (!room) {
    return;
  }

  room.delete(client);
  if (room.size === 0) {
    rooms.delete(client.documentId);
  }
}

function markRealtimeEventDelivered(eventId) {
  db.prepare("UPDATE realtime_events SET delivered_at = ? WHERE event_id = ?").run(
    new Date().toISOString(),
    eventId
  );
}

function pollRealtimeEvents() {
  const rows = db
    .prepare(
      `
      SELECT event_id, document_id, event_type, payload_json
      FROM realtime_events
      WHERE delivered_at IS NULL
      ORDER BY created_at ASC
    `
    )
    .all();

  for (const row of rows) {
    const payload = JSON.parse(row.payload_json);

    if (row.event_type === "access_revoked") {
      broadcast(
        row.document_id,
        {
          type: "access_revoked",
          documentId: row.document_id,
          targetUserId: payload.targetUserId,
        },
        (client) => client.userId === payload.targetUserId
      );

      const room = rooms.get(row.document_id);
      if (room) {
        for (const client of room) {
          if (client.userId === payload.targetUserId) {
            client.ws.close(4403, "access revoked");
          }
        }
      }
    } else {
      broadcast(row.document_id, {
        type: row.event_type,
        documentId: row.document_id,
        payload,
      });
    }

    markRealtimeEventDelivered(row.event_id);
  }
}

const server = new WebSocketServer({ port: REALTIME_PORT, path: "/ws" });

server.on("connection", (ws, request) => {
  try {
    const url = new URL(request.url, `ws://127.0.0.1:${REALTIME_PORT}`);
    const token = url.searchParams.get("token");
    const payload = verifySessionToken(token, REALTIME_SHARED_SECRET);
    const role = getEffectiveRole(payload.documentId, payload.userId);
    if (!role) {
      ws.close(4403, "permission denied");
      return;
    }

    const client = {
      ws,
      sessionId: payload.sessionId,
      documentId: payload.documentId,
      userId: payload.userId,
    };

    addClient(client);
    sendJson(ws, {
      type: "session_ready",
      sessionId: payload.sessionId,
      documentId: payload.documentId,
      userId: payload.userId,
      role,
    });

    broadcast(
      payload.documentId,
      {
        type: "presence_join",
        documentId: payload.documentId,
        userId: payload.userId,
      },
      (roomClient) => roomClient !== client
    );

    ws.on("message", (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString());
      } catch (_error) {
        sendJson(ws, { type: "error", code: "INVALID_INPUT", message: "message must be valid JSON" });
        return;
      }

      if (message.type === "heartbeat") {
        sendJson(ws, { type: "heartbeat_ack", at: new Date().toISOString() });
        return;
      }

      if (message.type === "presence") {
        broadcast(
          payload.documentId,
          {
            type: "presence",
            documentId: payload.documentId,
            userId: payload.userId,
            cursor: message.cursor || null,
            selection: message.selection || null,
          },
          (roomClient) => roomClient !== client
        );
        return;
      }

      if (message.type === "edit") {
        const currentRole = getEffectiveRole(payload.documentId, payload.userId);
        if (!currentRole || currentRole === "viewer") {
          sendJson(ws, {
            type: "error",
            code: "PERMISSION_DENIED",
            message: "viewer role cannot submit edit operations",
          });
          return;
        }

        broadcast(
          payload.documentId,
          {
            type: "edit",
            documentId: payload.documentId,
            userId: payload.userId,
            op: message.op,
            at: new Date().toISOString(),
          },
          (roomClient) => roomClient !== client
        );
        return;
      }

      sendJson(ws, { type: "error", code: "INVALID_INPUT", message: "unsupported realtime message type" });
    });

    ws.on("close", () => {
      removeClient(client);
      broadcast(payload.documentId, {
        type: "presence_leave",
        documentId: payload.documentId,
        userId: payload.userId,
      });
    });
  } catch (error) {
    sendJson(ws, { type: "error", code: "AUTH_FAILED", message: error.message });
    ws.close(4401, "invalid session");
  }
});

setInterval(pollRealtimeEvents, EVENT_POLL_INTERVAL_MS);

console.log(
  JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    msg: "realtime_server_started",
    port: REALTIME_PORT,
    databasePath: DATABASE_PATH,
  })
);
