const { verifySessionToken } = require("../../../shared/sessionToken");

const REALTIME_PROTOCOL = "collab.realtime.v1";

function extractSessionToken(request) {
  const protocolHeader = request.headers["sec-websocket-protocol"];
  if (typeof protocolHeader !== "string" || protocolHeader.trim() === "") {
    throw new Error("missing realtime auth protocol");
  }

  const protocols = protocolHeader
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!protocols.includes(REALTIME_PROTOCOL)) {
    throw new Error("missing realtime transport protocol");
  }

  const authProtocol = protocols.find((value) => value.startsWith("auth."));
  if (!authProtocol || authProtocol.length <= 5) {
    throw new Error("missing realtime auth token");
  }

  return authProtocol.slice(5);
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

function authenticateRealtimeRequest({ db, request, realtimeSharedSecret, port }) {
  void port;
  const token = extractSessionToken(request);
  const verified = verifySessionToken(token, realtimeSharedSecret);
  const role = getEffectiveRole(db, verified.documentId, verified.userId);

  return {
    verified,
    role,
  };
}

module.exports = {
  authenticateRealtimeRequest,
  extractSessionToken,
  getEffectiveRole,
  REALTIME_PROTOCOL,
};
