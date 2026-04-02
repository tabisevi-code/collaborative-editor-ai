const { createHttpError } = require("../lib/errors");
const { logInfo } = require("../lib/logger");

function ensureDocumentAccess(repository, user, documentId, minimumRole = "viewer") {
  const document = repository.getDocumentForUser(documentId, user);
  if (!document) {
    throw createHttpError(404, "NOT_FOUND", "document not found");
  }

  if (!document.canAccess) {
    throw createHttpError(403, "PERMISSION_DENIED", "document access denied");
  }

  const allowedRoles =
    minimumRole === "viewer"
      ? ["viewer", "editor", "owner"]
      : minimumRole === "editor"
        ? ["editor", "owner"]
        : ["owner"];

  if (!allowedRoles.includes(document.role) && !document.isAdmin) {
    throw createHttpError(403, "PERMISSION_DENIED", "document action not permitted");
  }

  return document;
}

function createDocumentsService({ repository, contentMaxBytes }) {
  return {
    createDocument(user, payload) {
      const bytes = Buffer.byteLength(payload.content || "", "utf8");
      if (bytes > contentMaxBytes) {
        throw createHttpError(413, "PAYLOAD_TOO_LARGE", "content exceeds limit", {
          maxBytes: contentMaxBytes,
          actualBytes: bytes,
        });
      }

      const document = repository.createDocument({
        title: payload.title,
        content: payload.content || "",
        ownerUserId: user.userId,
      });

      logInfo("document_created", {
        documentId: document.documentId,
        ownerId: document.ownerId,
      });

      return {
        documentId: document.documentId,
        title: document.title,
        ownerId: document.ownerId,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        currentVersionId: document.currentVersionId,
      };
    },

    getDocument(user, documentId) {
      const document = ensureDocumentAccess(repository, user, documentId, "viewer");
      return {
        documentId: document.documentId,
        title: document.title,
        content: document.content,
        updatedAt: document.updatedAt,
        currentVersionId: document.currentVersionId,
        role: document.role,
        revisionId: document.revisionId,
      };
    },

    updateContent(user, documentId, payload) {
      const document = ensureDocumentAccess(repository, user, documentId, "editor");
      const bytes = Buffer.byteLength(payload.content, "utf8");
      if (bytes > contentMaxBytes) {
        throw createHttpError(413, "PAYLOAD_TOO_LARGE", "content exceeds limit", {
          maxBytes: contentMaxBytes,
          actualBytes: bytes,
        });
      }

      const existingReplay = repository.getIdempotencyRecord(
        `document_update:${documentId}`,
        payload.requestId
      );
      if (existingReplay) {
        return existingReplay.responseBody;
      }

      if (document.revisionId !== payload.baseRevisionId) {
        if (document.content === payload.content) {
          return {
            documentId,
            updatedAt: document.updatedAt,
            revisionId: document.revisionId,
          };
        }

        throw createHttpError(409, "CONFLICT", "base revision is stale", {
          expectedRevisionId: document.revisionId,
          actualRevisionId: payload.baseRevisionId,
        });
      }

      return repository.updateDocumentContent({
        documentId,
        actorUserId: user.userId,
        requestId: payload.requestId,
        content: payload.content,
        baseRevisionId: payload.baseRevisionId,
        preUpdateVersionReason: payload.preUpdateVersionReason,
        updateReason: payload.updateReason,
        aiJobId: payload.aiJobId,
      });
    },

    listVersions(user, documentId, { limit, cursor }) {
      ensureDocumentAccess(repository, user, documentId, "viewer");
      return {
        documentId,
        ...repository.listVersions(documentId, limit, cursor ? Number(cursor) : null),
      };
    },

    revertDocument(user, documentId, payload) {
      const document = ensureDocumentAccess(repository, user, documentId, "owner");
      const targetVersion = repository.getVersionById(payload.targetVersionId);
      if (!targetVersion || targetVersion.document_id !== documentId) {
        throw createHttpError(404, "VERSION_NOT_FOUND", "target version not found");
      }

      return repository.revertDocument({
        documentId,
        actorUserId: user.userId,
        requestId: payload.requestId,
        targetVersionId: payload.targetVersionId,
      });
    },

    listPermissions(user, documentId) {
      ensureDocumentAccess(repository, user, documentId, "owner");
      return {
        documentId,
        members: repository.listPermissions(documentId),
      };
    },

    updatePermission(user, documentId, payload) {
      const document = ensureDocumentAccess(repository, user, documentId, "owner");
      if (payload.targetUserId === document.ownerId) {
        throw createHttpError(400, "INVALID_INPUT", "owner role cannot be reassigned");
      }

      return repository.updatePermission({
        documentId,
        actorUserId: user.userId,
        requestId: payload.requestId,
        targetUserId: payload.targetUserId,
        role: payload.role,
      });
    },

    revokePermission(user, documentId, targetUserId) {
      const document = ensureDocumentAccess(repository, user, documentId, "owner");
      if (targetUserId === document.ownerId) {
        throw createHttpError(400, "INVALID_INPUT", "owner access cannot be revoked");
      }

      return repository.revokePermission({
        documentId,
        actorUserId: user.userId,
        targetUserId,
      });
    },

    getAiPolicy(user, documentId) {
      ensureDocumentAccess(repository, user, documentId, "owner");
      return repository.getAiPolicy(documentId);
    },

    updateAiPolicy(user, documentId, payload) {
      ensureDocumentAccess(repository, user, documentId, "owner");
      return repository.updateAiPolicy({
        documentId,
        actorUserId: user.userId,
        aiEnabled: payload.aiEnabled,
        allowedRolesForAI: payload.allowedRolesForAI,
        dailyQuota: payload.dailyQuota,
      });
    },
  };
}

module.exports = {
  createDocumentsService,
  ensureDocumentAccess,
};
