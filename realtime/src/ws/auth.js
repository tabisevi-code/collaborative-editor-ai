const { URL } = require("url");

const { verifySessionToken } = require("../../../shared/sessionToken");

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
  const parsed = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
  const token = parsed.searchParams.get("token");
  const verified = verifySessionToken(token, realtimeSharedSecret);
  const role = getEffectiveRole(db, verified.documentId, verified.userId);

  return {
    verified,
    role,
  };
}

module.exports = {
  authenticateRealtimeRequest,
  getEffectiveRole,
};
