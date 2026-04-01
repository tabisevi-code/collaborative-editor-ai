const path = require("path");

const Database = require("better-sqlite3");
const { WebSocketServer } = require("ws");

const { initializeSchema } = require("../../backend/src/db/schema");
const { authenticateRealtimeRequest } = require("./ws/auth");
const { createEventPoller } = require("./ws/eventPoller");
const { createProtocolHandlers } = require("./ws/protocol");
const { createRoomRegistry } = require("./ws/rooms");
const { encodeAwarenessFrame, encodeSyncStep1, sendBinary, sendJson } = require("./ws/transport");

function createRealtimeServer({
  port = Number(process.env.REALTIME_PORT || 3001),
  databasePath = process.env.DATABASE_PATH || path.join(__dirname, "../../backend/data/app.sqlite"),
  realtimeSharedSecret = process.env.REALTIME_SHARED_SECRET || "dev_realtime_secret",
  pollIntervalMs = Number(process.env.EVENT_POLL_INTERVAL_MS || 1200),
} = {}) {
  const db = new Database(databasePath);
  initializeSchema(db);

  const roomRegistry = createRoomRegistry({ db });
  const protocolHandlers = createProtocolHandlers({
    getOrCreateRoom: roomRegistry.getOrCreateRoom,
  });
  const eventPoller = createEventPoller({
    db,
    clients: roomRegistry.clients,
    applyDocumentReset: roomRegistry.applyDocumentReset,
  });

  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws, request) => {
    try {
      const { verified, role } = authenticateRealtimeRequest({
        db,
        request,
        realtimeSharedSecret,
        port,
      });

      if (!role) {
        sendJson(ws, {
          type: "error",
          code: "PERMISSION_DENIED",
          message: "You no longer have access to this document.",
        });
        ws.close(4403, "permission denied");
        return;
      }

      const client = {
        ws,
        sessionId: verified.sessionId,
        documentId: verified.documentId,
        userId: verified.userId,
        role,
        awarenessClientIds: new Set(),
      };

      const room = roomRegistry.addClient(client);

      sendJson(ws, {
        type: "session_ready",
        sessionId: verified.sessionId,
        documentId: verified.documentId,
        userId: verified.userId,
        role,
      });

      sendBinary(ws, encodeSyncStep1(room.ydoc));
      if (room.awareness.getStates().size > 0) {
        sendBinary(ws, encodeAwarenessFrame(room.awareness, [...room.awareness.getStates().keys()]));
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

          protocolHandlers.handleBinaryMessage(client, incoming);
        } catch (error) {
          sendJson(ws, {
            type: "error",
            code: "REALTIME_MESSAGE_ERROR",
            message: error instanceof Error ? error.message : "Failed to process realtime frame.",
          });
        }
      });

      ws.on("close", () => {
        roomRegistry.removeClient(client);
      });

      ws.on("error", () => {
        roomRegistry.removeClient(client);
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

  const pollTimer = eventPoller.start(pollIntervalMs);

  function terminateWebSocket(client) {
    return new Promise((resolve) => {
      if (!client || client.readyState === client.CLOSED) {
        resolve();
        return;
      }

      const timeout = setTimeout(resolve, 250);
      if (typeof timeout.unref === "function") {
        timeout.unref();
      }

      client.once("close", () => {
        clearTimeout(timeout);
        resolve();
      });
      client.terminate();
    });
  }

  return {
    port: wss.address()?.port || port,
    db,
    wss,
    async close() {
      clearInterval(pollTimer);

      if (typeof wss.clients?.forEach === "function") {
        await Promise.all([...wss.clients].map(terminateWebSocket));
      }

      roomRegistry.rooms.clear();
      roomRegistry.clients.clear();

      return new Promise((resolve, reject) => {
        const httpServer = wss._server;

        function finish(error) {
          if (error) {
            reject(error);
            return;
          }

          db.close();
          resolve();
        }

        if (!httpServer || !httpServer.listening) {
          finish();
          return;
        }

        if (typeof httpServer.closeAllConnections === "function") {
          httpServer.closeAllConnections();
        }

        if (typeof httpServer.unref === "function") {
          httpServer.unref();
        }

        httpServer.close(finish);
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
