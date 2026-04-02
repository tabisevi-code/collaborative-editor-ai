const { nowIso, sendJson } = require("./transport");

function createEventPoller({ db, clients, applyDocumentReset }) {
  const listUndeliveredEvents = db.prepare(`
    SELECT event_id, document_id, event_type, payload_json
    FROM realtime_events
    WHERE delivered_at IS NULL
    ORDER BY created_at ASC
  `);

  const markDelivered = db.prepare("UPDATE realtime_events SET delivered_at = ? WHERE event_id = ?");

  function processRealtimeEvents() {
    const events = listUndeliveredEvents.all();
    if (events.length === 0) {
      return;
    }

    const deliveredAt = nowIso();
    for (const event of events) {
      const payload = JSON.parse(event.payload_json);

      if (event.event_type === "document_reverted") {
        const row = db.prepare("SELECT content FROM documents WHERE document_id = ?").get(event.document_id);
        applyDocumentReset(event.document_id, row?.content || "");

        for (const client of clients) {
          if (client.documentId !== event.document_id) {
            continue;
          }

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

      markDelivered.run(deliveredAt, event.event_id);
    }
  }

  function start(pollIntervalMs) {
    const timer = setInterval(processRealtimeEvents, pollIntervalMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    return timer;
  }

  return {
    start,
  };
}

module.exports = {
  createEventPoller,
};
