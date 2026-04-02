const Y = require("yjs");
const awarenessProtocol = require("y-protocols/awareness");

const { encodeAwarenessFrame, encodeSyncStep2, sendBinary } = require("./transport");

const ROOM_IDLE_TTL_MS = 5000;

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
    cleanupTimer: null,
  };
}

function createRoomRegistry({ db }) {
  const rooms = new Map();
  const clients = new Set();

  function getDocumentContent(documentId) {
    const row = db.prepare("SELECT content FROM documents WHERE document_id = ?").get(documentId);
    return row?.content || "";
  }

  function getOrCreateRoom(documentId) {
    let room = rooms.get(documentId);
    if (room) {
      if (room.cleanupTimer) {
        clearTimeout(room.cleanupTimer);
        room.cleanupTimer = null;
      }
      return room;
    }

    room = createRoom(documentId, getDocumentContent(documentId));
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

      const payload = encodeAwarenessFrame(room.awareness, changedClientIds);
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

  function addClient(client) {
    clients.add(client);
    const room = getOrCreateRoom(client.documentId);
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    room.clients.add(client);
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

    if (room.clients.size === 0) {
      room.cleanupTimer = setTimeout(() => {
        const currentRoom = rooms.get(client.documentId);
        if (!currentRoom || currentRoom.clients.size > 0) {
          return;
        }

        rooms.delete(client.documentId);
      }, ROOM_IDLE_TTL_MS);

      if (typeof room.cleanupTimer.unref === "function") {
        room.cleanupTimer.unref();
      }
    }
  }

  function applyDocumentReset(documentId, nextContent) {
    const room = rooms.get(documentId);
    if (!room) {
      return;
    }

    const text = room.ydoc.getText("content");
    room.ydoc.transact(() => {
      const current = text.toString();
      if (current.length > 0) {
        text.delete(0, current.length);
      }
      if (nextContent.length > 0) {
        text.insert(0, nextContent);
      }
    }, null);
  }

  return {
    rooms,
    clients,
    getOrCreateRoom,
    addClient,
    removeClient,
    applyDocumentReset,
  };
}

module.exports = {
  createRoomRegistry,
};
