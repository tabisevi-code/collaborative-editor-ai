const { appendAuditLog } = require("../db/schema");
const { makeId, nowIso } = require("../lib/ids");
const { parseJson } = require("./repositoryUtils");

function createPermissionsRepository({ db, ensureUser }) {
  const statements = {
    listPermissions: db.prepare(`
      SELECT user_id, role, updated_at
      FROM document_permissions
      WHERE document_id = ?
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, user_id
    `),
    getPermissionEntry: db.prepare(`
      SELECT document_id, user_id, role, updated_at
      FROM document_permissions
      WHERE document_id = ? AND user_id = ?
    `),
    upsertPermission: db.prepare(`
      INSERT INTO document_permissions (document_id, user_id, role, updated_at)
      VALUES (@documentId, @userId, @role, @updatedAt)
      ON CONFLICT(document_id, user_id) DO UPDATE SET
        role = excluded.role,
        updated_at = excluded.updated_at
    `),
    deletePermission: db.prepare(`
      DELETE FROM document_permissions
      WHERE document_id = ? AND user_id = ?
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
    insertRealtimeEvent: db.prepare(`
      INSERT INTO realtime_events (event_id, document_id, event_type, payload_json, created_at, delivered_at)
      VALUES (@eventId, @documentId, @eventType, @payloadJson, @createdAt, NULL)
    `),
  };

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

  function listPermissions(documentId) {
    return statements.listPermissions.all(documentId).map((row) => ({
      userId: row.user_id,
      role: row.role,
      updatedAt: row.updated_at,
    }));
  }

  function getPermissionEntry(documentId, userId) {
    return statements.getPermissionEntry.get(documentId, userId) || null;
  }

  function updatePermission({ documentId, actorUserId, requestId, targetUserId, role }) {
    const execute = db.transaction(() => {
      const existingIdempotency = getIdempotencyRecord(`permission_update:${documentId}`, requestId);
      if (existingIdempotency) {
        return existingIdempotency.responseBody;
      }

      const timestamp = nowIso();
      ensureUser({ userId: targetUserId, displayName: targetUserId });
      statements.upsertPermission.run({
        documentId,
        userId: targetUserId,
        role,
        updatedAt: timestamp,
      });

      appendAuditLog(db, {
        actorUserId,
        documentId,
        actionType: "permission_updated",
        metadata: { requestId, targetUserId, role },
      });

      statements.insertRealtimeEvent.run({
        eventId: makeId("rt"),
        documentId,
        eventType: "permission_updated",
        payloadJson: JSON.stringify({ documentId, targetUserId, role }),
        createdAt: timestamp,
      });

      const responseBody = {
        documentId,
        targetUserId,
        role,
        updatedAt: timestamp,
      };

      storeIdempotencyRecord(`permission_update:${documentId}`, requestId, 200, responseBody);
      return responseBody;
    });

    return execute();
  }

  function revokePermission({ documentId, actorUserId, targetUserId }) {
    const timestamp = nowIso();
    statements.deletePermission.run(documentId, targetUserId);

    appendAuditLog(db, {
      actorUserId,
      documentId,
      actionType: "permission_revoked",
      metadata: { targetUserId },
    });

    statements.insertRealtimeEvent.run({
      eventId: makeId("rt"),
      documentId,
      eventType: "access_revoked",
      payloadJson: JSON.stringify({ documentId, targetUserId }),
      createdAt: timestamp,
    });

    return {
      documentId,
      targetUserId,
      revoked: true,
    };
  }

  return {
    listPermissions,
    getPermissionEntry,
    updatePermission,
    revokePermission,
  };
}

module.exports = {
  createPermissionsRepository,
};
