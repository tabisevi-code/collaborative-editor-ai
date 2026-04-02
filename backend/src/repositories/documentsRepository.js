const { appendAuditLog } = require("../db/schema");
const { makeId, nowIso } = require("../lib/ids");
const { getEffectiveRole, parseJson } = require("./repositoryUtils");

function createDocumentsRepository({ db }) {
  const statements = {
    getDocumentWithStoredRole: db.prepare(`
      SELECT
        d.document_id,
        d.title,
        d.owner_user_id,
        d.content,
        d.created_at,
        d.updated_at,
        d.current_version_id,
        d.revision_id,
        p.role AS stored_role
      FROM documents d
      LEFT JOIN document_permissions p
        ON p.document_id = d.document_id
       AND p.user_id = @userId
      WHERE d.document_id = @documentId
    `),
    getDocumentById: db.prepare(`
      SELECT
        document_id,
        title,
        owner_user_id,
        content,
        created_at,
        updated_at,
        current_version_id,
        revision_id
      FROM documents
      WHERE document_id = ?
    `),
    getVersionById: db.prepare(`
      SELECT
        version_id,
        document_id,
        version_number,
        created_at,
        created_by_user_id,
        reason,
        snapshot_content,
        base_revision_id
      FROM document_versions
      WHERE version_id = ?
    `),
    getMaxVersionNumber: db.prepare(`
      SELECT COALESCE(MAX(version_number), 0) AS maxVersionNumber
      FROM document_versions
      WHERE document_id = ?
    `),
    listVersions: db.prepare(`
      SELECT
        version_id,
        version_number,
        created_at,
        created_by_user_id,
        reason
      FROM document_versions
      WHERE document_id = @documentId
        AND (@cursorVersionNumber IS NULL OR version_number < @cursorVersionNumber)
      ORDER BY version_number DESC
      LIMIT @limitPlusOne
    `),
    insertDocument: db.prepare(`
      INSERT INTO documents (
        document_id,
        title,
        owner_user_id,
        content,
        created_at,
        updated_at,
        current_version_id,
        revision_id
      ) VALUES (
        @documentId,
        @title,
        @ownerUserId,
        @content,
        @createdAt,
        @updatedAt,
        @currentVersionId,
        @revisionId
      )
    `),
    insertVersion: db.prepare(`
      INSERT INTO document_versions (
        version_id,
        document_id,
        version_number,
        created_at,
        created_by_user_id,
        reason,
        snapshot_content,
        base_revision_id
      ) VALUES (
        @versionId,
        @documentId,
        @versionNumber,
        @createdAt,
        @createdByUserId,
        @reason,
        @snapshotContent,
        @baseRevisionId
      )
    `),
    updateDocumentState: db.prepare(`
      UPDATE documents
      SET content = @content,
          updated_at = @updatedAt,
          current_version_id = @currentVersionId,
          revision_id = @revisionId
      WHERE document_id = @documentId
    `),
    findIdempotency: db.prepare(`
      SELECT scope, request_id, response_status, response_body, created_at
      FROM idempotency_keys
      WHERE scope = ? AND request_id = ?
    `),
    insertIdempotency: db.prepare(`
      INSERT INTO idempotency_keys (scope, request_id, response_status, response_body, created_at)
      VALUES (@scope, @requestId, @responseStatus, @responseBody, @createdAt)
    `),
    upsertOwnerPermission: db.prepare(`
      INSERT INTO document_permissions (document_id, user_id, role, updated_at)
      VALUES (@documentId, @userId, @role, @updatedAt)
      ON CONFLICT(document_id, user_id) DO UPDATE SET
        role = excluded.role,
        updated_at = excluded.updated_at
    `),
    upsertDefaultAiPolicy: db.prepare(`
      INSERT INTO ai_policies (document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at)
      VALUES (@documentId, @aiEnabled, @allowedRolesCsv, @dailyQuota, @updatedAt)
      ON CONFLICT(document_id) DO UPDATE SET
        ai_enabled = excluded.ai_enabled,
        allowed_roles_csv = excluded.allowed_roles_csv,
        daily_quota = excluded.daily_quota,
        updated_at = excluded.updated_at
    `),
    insertRealtimeEvent: db.prepare(`
      INSERT INTO realtime_events (event_id, document_id, event_type, payload_json, created_at, delivered_at)
      VALUES (@eventId, @documentId, @eventType, @payloadJson, @createdAt, NULL)
    `),
  };

  function mapDocumentRow(row, user) {
    if (!row) {
      return null;
    }

    const role = user ? getEffectiveRole(user, row.stored_role, row.owner_user_id) : null;
    return {
      documentId: row.document_id,
      title: row.title,
      ownerId: row.owner_user_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentVersionId: row.current_version_id,
      revisionId: row.revision_id,
      role,
    };
  }

  function getDocumentForUser(documentId, user) {
    const row = statements.getDocumentWithStoredRole.get({ documentId, userId: user.userId });
    const document = mapDocumentRow(row, user);
    if (!document) {
      return null;
    }

    return {
      ...document,
      canAccess: Boolean(document.role),
      isAdmin: user.globalRole === "admin",
    };
  }

  function getDocumentById(documentId) {
    return mapDocumentRow(statements.getDocumentById.get(documentId), null);
  }

  function getVersionById(versionId) {
    return statements.getVersionById.get(versionId) || null;
  }

  function getIdempotencyRecord(scope, requestId) {
    const row = statements.findIdempotency.get(scope, requestId);
    if (!row) {
      return null;
    }

    return {
      scope: row.scope,
      requestId: row.request_id,
      responseStatus: row.response_status,
      responseBody: parseJson(row.response_body, {}),
      createdAt: row.created_at,
    };
  }

  function storeIdempotencyRecord(scope, requestId, responseStatus, responseBody) {
    statements.insertIdempotency.run({
      scope,
      requestId,
      responseStatus,
      responseBody: JSON.stringify(responseBody),
      createdAt: nowIso(),
    });
  }

  function createDocument({ title, content, ownerUserId }) {
    const execute = db.transaction(() => {
      const createdAt = nowIso();
      const documentId = makeId("doc");
      const versionId = makeId("ver");
      const revisionId = "rev_1";

      statements.insertDocument.run({
        documentId,
        title,
        ownerUserId,
        content,
        createdAt,
        updatedAt: createdAt,
        currentVersionId: versionId,
        revisionId,
      });

      statements.upsertOwnerPermission.run({
        documentId,
        userId: ownerUserId,
        role: "owner",
        updatedAt: createdAt,
      });

      statements.insertVersion.run({
        versionId,
        documentId,
        versionNumber: 1,
        createdAt,
        createdByUserId: ownerUserId,
        reason: "initial_create",
        snapshotContent: content,
        baseRevisionId: null,
      });

      statements.upsertDefaultAiPolicy.run({
        documentId,
        aiEnabled: 1,
        allowedRolesCsv: "owner,editor",
        dailyQuota: 5,
        updatedAt: createdAt,
      });

      appendAuditLog(db, {
        actorUserId: ownerUserId,
        documentId,
        actionType: "document_created",
        metadata: { title },
      });

      return getDocumentForUser(documentId, { userId: ownerUserId, globalRole: "user" });
    });

    return execute();
  }

  function listVersions(documentId, limit, cursor) {
    const rows = statements.listVersions.all({
      documentId,
      cursorVersionNumber: cursor,
      limitPlusOne: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const selectedRows = rows.slice(0, limit);
    const nextCursor = hasNextPage ? String(selectedRows[selectedRows.length - 1].version_number) : null;

    return {
      versions: selectedRows.map((row) => ({
        versionId: row.version_id,
        versionNumber: row.version_number,
        createdAt: row.created_at,
        createdBy: row.created_by_user_id,
        reason: row.reason,
      })),
      nextCursor,
    };
  }

  function updateDocumentContent({
    documentId,
    actorUserId,
    requestId,
    content,
    baseRevisionId,
    preUpdateVersionReason = null,
    updateReason = "content_update",
    aiJobId = null,
  }) {
    const execute = db.transaction(() => {
      const existingIdempotency = getIdempotencyRecord(`document_update:${documentId}`, requestId);
      if (existingIdempotency) {
        return existingIdempotency.responseBody;
      }

      const document = statements.getDocumentById.get(documentId);
      const currentMaxVersionNumber = statements.getMaxVersionNumber.get(documentId).maxVersionNumber;
      let nextVersionNumber = currentMaxVersionNumber;
      const versionId = makeId("ver");
      const updatedAt = nowIso();
      let preApplyVersionId = null;

      if (preUpdateVersionReason) {
        nextVersionNumber += 1;
        preApplyVersionId = makeId("ver");
        statements.insertVersion.run({
          versionId: preApplyVersionId,
          documentId,
          versionNumber: nextVersionNumber,
          createdAt: updatedAt,
          createdByUserId: actorUserId,
          reason: preUpdateVersionReason,
          snapshotContent: document.content,
          baseRevisionId: document.revision_id,
        });
      }

      nextVersionNumber += 1;
      const revisionId = `rev_${nextVersionNumber}`;

      statements.insertVersion.run({
        versionId,
        documentId,
        versionNumber: nextVersionNumber,
        createdAt: updatedAt,
        createdByUserId: actorUserId,
        reason: updateReason,
        snapshotContent: content,
        baseRevisionId,
      });

      statements.updateDocumentState.run({
        documentId,
        content,
        updatedAt,
        currentVersionId: versionId,
        revisionId,
      });

      appendAuditLog(db, {
        actorUserId,
        documentId,
        actionType: updateReason.startsWith("ai_") ? "ai_applied" : "document_updated",
        metadata: {
          requestId,
          baseRevisionId,
          newRevisionId: revisionId,
          updateReason,
          preUpdateVersionReason,
          preApplyVersionId,
          aiJobId,
        },
      });

      const responseBody = {
        documentId,
        updatedAt,
        revisionId,
      };

      storeIdempotencyRecord(`document_update:${documentId}`, requestId, 200, responseBody);
      return responseBody;
    });

    return execute();
  }

  function revertDocument({ documentId, actorUserId, requestId, targetVersionId }) {
    const execute = db.transaction(() => {
      const existingIdempotency = getIdempotencyRecord(`document_revert:${documentId}`, requestId);
      if (existingIdempotency) {
        return existingIdempotency.responseBody;
      }

      const document = statements.getDocumentById.get(documentId);
      const targetVersion = statements.getVersionById.get(targetVersionId);
      const currentMaxVersionNumber = statements.getMaxVersionNumber.get(documentId).maxVersionNumber;
      const backupVersionId = makeId("ver");
      const revertVersionId = makeId("ver");
      const timestamp = nowIso();

      statements.insertVersion.run({
        versionId: backupVersionId,
        documentId,
        versionNumber: currentMaxVersionNumber + 1,
        createdAt: timestamp,
        createdByUserId: actorUserId,
        reason: "pre_revert_backup",
        snapshotContent: document.content,
        baseRevisionId: document.revision_id,
      });

      statements.insertVersion.run({
        versionId: revertVersionId,
        documentId,
        versionNumber: currentMaxVersionNumber + 2,
        createdAt: timestamp,
        createdByUserId: actorUserId,
        reason: "revert",
        snapshotContent: targetVersion.snapshot_content,
        baseRevisionId: document.revision_id,
      });

      const revisionId = `rev_${currentMaxVersionNumber + 2}`;
      statements.updateDocumentState.run({
        documentId,
        content: targetVersion.snapshot_content,
        updatedAt: timestamp,
        currentVersionId: revertVersionId,
        revisionId,
      });

      appendAuditLog(db, {
        actorUserId,
        documentId,
        actionType: "document_reverted",
        metadata: {
          requestId,
          targetVersionId,
          backupVersionId,
          currentVersionId: revertVersionId,
        },
      });

      statements.insertRealtimeEvent.run({
        eventId: makeId("rt"),
        documentId,
        eventType: "document_reverted",
        payloadJson: JSON.stringify({
          documentId,
          targetVersionId,
          currentVersionId: revertVersionId,
          revisionId,
        }),
        createdAt: timestamp,
      });

      const responseBody = {
        documentId,
        currentVersionId: revertVersionId,
        revertedFromVersionId: targetVersionId,
        updatedAt: timestamp,
      };

      storeIdempotencyRecord(`document_revert:${documentId}`, requestId, 200, responseBody);
      return responseBody;
    });

    return execute();
  }

  return {
    getDocumentForUser,
    getDocumentById,
    getVersionById,
    createDocument,
    listVersions,
    getIdempotencyRecord,
    updateDocumentContent,
    revertDocument,
  };
}

module.exports = {
  createDocumentsRepository,
};
