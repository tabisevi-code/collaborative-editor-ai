const { makeId, nowIso } = require("../lib/ids");
const { appendAuditLog } = require("../db/schema");

function parseJson(rawValue, fallbackValue = null) {
  if (!rawValue) {
    return fallbackValue;
  }

  return JSON.parse(rawValue);
}

function getEffectiveRole(user, storedRole, ownerUserId) {
  if (user.globalRole === "admin") {
    return ownerUserId === user.userId ? "owner" : "editor";
  }

  if (ownerUserId === user.userId) {
    return "owner";
  }

  if (storedRole === "owner" || storedRole === "editor" || storedRole === "viewer") {
    return storedRole;
  }

  return null;
}

/**
 * The repository is the only layer allowed to talk SQL. Every route/service
 * calls these methods so we keep persistence decisions isolated from API code.
 */
function createAppRepository(db) {
  const statements = {
    findUserByToken: db.prepare(`
      SELECT user_id, display_name, global_role, access_token, created_at, updated_at
      FROM users
      WHERE access_token = ?
    `),
    findUserById: db.prepare(`
      SELECT user_id, display_name, global_role, access_token, created_at, updated_at
      FROM users
      WHERE user_id = ?
    `),
    upsertUser: db.prepare(`
      INSERT INTO users (user_id, display_name, global_role, access_token, created_at, updated_at)
      VALUES (@userId, @displayName, @globalRole, @accessToken, @createdAt, @updatedAt)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `),
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
    getAiPolicy: db.prepare(`
      SELECT document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at
      FROM ai_policies
      WHERE document_id = ?
    `),
    upsertAiPolicy: db.prepare(`
      INSERT INTO ai_policies (document_id, ai_enabled, allowed_roles_csv, daily_quota, updated_at)
      VALUES (@documentId, @aiEnabled, @allowedRolesCsv, @dailyQuota, @updatedAt)
      ON CONFLICT(document_id) DO UPDATE SET
        ai_enabled = excluded.ai_enabled,
        allowed_roles_csv = excluded.allowed_roles_csv,
        daily_quota = excluded.daily_quota,
        updated_at = excluded.updated_at
    `),
    insertAiJob: db.prepare(`
      INSERT INTO ai_jobs (
        job_id,
        document_id,
        user_id,
        action_type,
        status,
        request_json,
        result_json,
        error_code,
        error_message,
        base_version_id,
        created_at,
        updated_at
      ) VALUES (
        @jobId,
        @documentId,
        @userId,
        @actionType,
        @status,
        @requestJson,
        @resultJson,
        @errorCode,
        @errorMessage,
        @baseVersionId,
        @createdAt,
        @updatedAt
      )
    `),
    getAiJob: db.prepare(`
      SELECT
        job_id,
        document_id,
        user_id,
        action_type,
        status,
        request_json,
        result_json,
        error_code,
        error_message,
        base_version_id,
        created_at,
        updated_at
      FROM ai_jobs
      WHERE job_id = ?
    `),
    updateAiJob: db.prepare(`
      UPDATE ai_jobs
      SET status = @status,
          result_json = @resultJson,
          error_code = @errorCode,
          error_message = @errorMessage,
          updated_at = @updatedAt
      WHERE job_id = @jobId
    `),
    countAiJobsToday: db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_jobs
      WHERE document_id = @documentId
        AND user_id = @userId
        AND substr(created_at, 1, 10) = @day
    `),
    insertExportJob: db.prepare(`
      INSERT INTO export_jobs (
        job_id,
        document_id,
        user_id,
        format,
        status,
        result_json,
        error_code,
        error_message,
        created_at,
        updated_at
      ) VALUES (
        @jobId,
        @documentId,
        @userId,
        @format,
        @status,
        @resultJson,
        @errorCode,
        @errorMessage,
        @createdAt,
        @updatedAt
      )
    `),
    getExportJob: db.prepare(`
      SELECT
        job_id,
        document_id,
        user_id,
        format,
        status,
        result_json,
        error_code,
        error_message,
        created_at,
        updated_at
      FROM export_jobs
      WHERE job_id = ?
    `),
    updateExportJob: db.prepare(`
      UPDATE export_jobs
      SET status = @status,
          result_json = @resultJson,
          error_code = @errorCode,
          error_message = @errorMessage,
          updated_at = @updatedAt
      WHERE job_id = @jobId
    `),
    insertRealtimeEvent: db.prepare(`
      INSERT INTO realtime_events (event_id, document_id, event_type, payload_json, created_at, delivered_at)
      VALUES (@eventId, @documentId, @eventType, @payloadJson, @createdAt, NULL)
    `),
  };

  function mapUser(row) {
    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      displayName: row.display_name,
      globalRole: row.global_role,
      accessToken: row.access_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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

  function ensureUser({ userId, displayName = userId, globalRole = "user" }) {
    const existingUser = mapUser(statements.findUserById.get(userId));
    if (existingUser) {
      return existingUser;
    }

    const createdAt = nowIso();
    const accessToken = `token_${userId}`;
    statements.upsertUser.run({
      userId,
      displayName,
      globalRole,
      accessToken,
      createdAt,
      updatedAt: createdAt,
    });

    return mapUser(statements.findUserById.get(userId));
  }

  function findUserByToken(token) {
    return mapUser(statements.findUserByToken.get(token));
  }

  function findUserById(userId) {
    return mapUser(statements.findUserById.get(userId));
  }

  function getDocumentForUser(documentId, user) {
    const row = statements.getDocumentWithStoredRole.get({
      documentId,
      userId: user.userId,
    });

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

      statements.upsertPermission.run({
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

      statements.upsertAiPolicy.run({
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

  function listPermissions(documentId) {
    return statements.listPermissions.all(documentId).map((row) => ({
      userId: row.user_id,
      role: row.role,
      updatedAt: row.updated_at,
    }));
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

  function updateDocumentContent({ documentId, actorUserId, requestId, content, baseRevisionId }) {
    const execute = db.transaction(() => {
      const existingIdempotency = getIdempotencyRecord(`document_update:${documentId}`, requestId);
      if (existingIdempotency) {
        return existingIdempotency.responseBody;
      }

      const document = statements.getDocumentById.get(documentId);
      const nextVersionNumber = statements.getMaxVersionNumber.get(documentId).maxVersionNumber + 1;
      const versionId = makeId("ver");
      const revisionId = `rev_${nextVersionNumber}`;
      const updatedAt = nowIso();

      statements.insertVersion.run({
        versionId,
        documentId,
        versionNumber: nextVersionNumber,
        createdAt: updatedAt,
        createdByUserId: actorUserId,
        reason: "content_update",
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
        actionType: "document_updated",
        metadata: { requestId, baseRevisionId, newRevisionId: revisionId },
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

  function getAiPolicy(documentId) {
    const row = statements.getAiPolicy.get(documentId);
    if (!row) {
      return null;
    }

    return {
      documentId: row.document_id,
      aiEnabled: row.ai_enabled === 1,
      allowedRolesForAI: row.allowed_roles_csv.split(",").filter(Boolean),
      dailyQuota: row.daily_quota,
      updatedAt: row.updated_at,
    };
  }

  function updateAiPolicy({ documentId, actorUserId, aiEnabled, allowedRolesForAI, dailyQuota }) {
    const updatedAt = nowIso();
    statements.upsertAiPolicy.run({
      documentId,
      aiEnabled: aiEnabled ? 1 : 0,
      allowedRolesCsv: allowedRolesForAI.join(","),
      dailyQuota,
      updatedAt,
    });

    appendAuditLog(db, {
      actorUserId,
      documentId,
      actionType: "ai_policy_updated",
      metadata: { aiEnabled, allowedRolesForAI, dailyQuota },
    });

    return getAiPolicy(documentId);
  }

  function countAiJobsToday(documentId, userId, day) {
    return statements.countAiJobsToday.get({ documentId, userId, day }).count;
  }

  function createAiJob({ documentId, userId, actionType, requestPayload, baseVersionId }) {
    const timestamp = nowIso();
    const jobId = makeId("aijob");

    statements.insertAiJob.run({
      jobId,
      documentId,
      userId,
      actionType,
      status: "PENDING",
      requestJson: JSON.stringify(requestPayload),
      resultJson: null,
      errorCode: null,
      errorMessage: null,
      baseVersionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    appendAuditLog(db, {
      actorUserId: userId,
      documentId,
      actionType: "ai_job_created",
      metadata: { jobId, actionType },
    });

    return getAiJob(jobId);
  }

  function updateAiJob({ jobId, status, result = null, errorCode = null, errorMessage = null }) {
    statements.updateAiJob.run({
      jobId,
      status,
      resultJson: result ? JSON.stringify(result) : null,
      errorCode,
      errorMessage,
      updatedAt: nowIso(),
    });

    return getAiJob(jobId);
  }

  function getAiJob(jobId) {
    const row = statements.getAiJob.get(jobId);
    if (!row) {
      return null;
    }

    return {
      jobId: row.job_id,
      documentId: row.document_id,
      userId: row.user_id,
      actionType: row.action_type,
      status: row.status,
      request: parseJson(row.request_json, {}),
      result: parseJson(row.result_json, null),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      baseVersionId: row.base_version_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function createExportJob({ documentId, userId, format, initialStatus = "PENDING", result = null }) {
    const timestamp = nowIso();
    const jobId = makeId("expjob");

    statements.insertExportJob.run({
      jobId,
      documentId,
      userId,
      format,
      status: initialStatus,
      resultJson: result ? JSON.stringify(result) : null,
      errorCode: null,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    appendAuditLog(db, {
      actorUserId: userId,
      documentId,
      actionType: "export_requested",
      metadata: { jobId, format },
    });

    return getExportJob(jobId);
  }

  function updateExportJob({ jobId, status, result = null, errorCode = null, errorMessage = null }) {
    statements.updateExportJob.run({
      jobId,
      status,
      resultJson: result ? JSON.stringify(result) : null,
      errorCode,
      errorMessage,
      updatedAt: nowIso(),
    });

    return getExportJob(jobId);
  }

  function getExportJob(jobId) {
    const row = statements.getExportJob.get(jobId);
    if (!row) {
      return null;
    }

    return {
      jobId: row.job_id,
      documentId: row.document_id,
      userId: row.user_id,
      format: row.format,
      status: row.status,
      result: parseJson(row.result_json, null),
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function resetForTests() {
    db.exec(`
      DELETE FROM realtime_events;
      DELETE FROM export_jobs;
      DELETE FROM ai_jobs;
      DELETE FROM ai_policies;
      DELETE FROM audit_logs;
      DELETE FROM idempotency_keys;
      DELETE FROM document_versions;
      DELETE FROM document_permissions;
      DELETE FROM documents;
    `);
  }

  return {
    db,
    ensureUser,
    findUserByToken,
    findUserById,
    getDocumentForUser,
    getDocumentById(documentId) {
      return mapDocumentRow(statements.getDocumentById.get(documentId), null);
    },
    getVersionById(versionId) {
      return statements.getVersionById.get(versionId) || null;
    },
    createDocument,
    listVersions,
    listPermissions,
    getPermissionEntry(documentId, userId) {
      return statements.getPermissionEntry.get(documentId, userId) || null;
    },
    getIdempotencyRecord,
    updateDocumentContent,
    revertDocument,
    updatePermission,
    revokePermission,
    getAiPolicy,
    updateAiPolicy,
    countAiJobsToday,
    createAiJob,
    updateAiJob,
    getAiJob,
    createExportJob,
    updateExportJob,
    getExportJob,
    resetForTests,
    close() {
      db.close();
    },
  };
}

module.exports = { createAppRepository };
