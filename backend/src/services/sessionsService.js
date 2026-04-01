const { signSessionToken } = require("../../../shared/sessionToken");
const { ensureDocumentAccess } = require("./documentsService");
const { makeId } = require("../lib/ids");

function createSessionsService({ repository, realtimeWsBaseUrl, realtimeSharedSecret, sessionTokenTtlSeconds }) {
  return {
    createSession(user, documentId) {
      const document = ensureDocumentAccess(repository, user, documentId, "viewer");
      const sessionId = makeId("sess");
      const exp = Date.now() + sessionTokenTtlSeconds * 1000;
      const token = signSessionToken(
        {
          sessionId,
          documentId,
          userId: user.userId,
          role: document.role,
          exp,
        },
        realtimeSharedSecret
      );

      return {
        sessionId,
        wsUrl: `${realtimeWsBaseUrl}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`,
        role: document.role,
      };
    },
  };
}

module.exports = { createSessionsService };
