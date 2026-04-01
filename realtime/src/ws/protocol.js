const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const decoding = require("lib0/decoding");

const { MESSAGE_AWARENESS, MESSAGE_SYNC } = require("./constants");
const { encodeSyncStep2, sendJson } = require("./transport");

function createProtocolHandlers({ getOrCreateRoom }) {
  function handleSyncMessage(client, decoder) {
    const room = getOrCreateRoom(client.documentId);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === syncProtocol.messageYjsSyncStep1) {
      client.ws.send(encodeSyncStep2(room.ydoc));
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

  function handleBinaryMessage(client, incoming) {
    const decoder = decoding.createDecoder(new Uint8Array(incoming));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      handleSyncMessage(client, decoder);
      return;
    }

    if (messageType === MESSAGE_AWARENESS) {
      handleAwarenessMessage(client, decoder);
      return;
    }

    sendJson(client.ws, {
      type: "error",
      code: "UNSUPPORTED_MESSAGE",
      message: "Unsupported realtime message type.",
    });
  }

  return {
    handleBinaryMessage,
  };
}

module.exports = {
  createProtocolHandlers,
};
