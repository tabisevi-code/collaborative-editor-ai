const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const encoding = require("lib0/encoding");

const { MESSAGE_SYNC, MESSAGE_AWARENESS } = require("./constants");

function nowIso() {
  return new Date().toISOString();
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

function encodeAwarenessFrame(awareness, clientIds) {
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

module.exports = {
  nowIso,
  encodeSyncStep1,
  encodeSyncStep2,
  encodeAwarenessFrame,
  sendJson,
  sendBinary,
};
