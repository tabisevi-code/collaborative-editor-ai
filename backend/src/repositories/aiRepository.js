const { appendAuditLog } = require("../db/schema");
const { makeId, nowIso } = require("../lib/ids");
const { parseJson } = require("./repositoryUtils");

function createAiRepository({ db }) {
  const statements = {
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
    countQueuedAiJobsToday: db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_jobs
      WHERE document_id = @documentId
        AND user_id = @userId
        AND substr(created_at, 1, 10) = @day
    `),
    countAiHistoryToday: db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_history
      WHERE document_id = @documentId
        AND user_id = @userId
        AND substr(created_at, 1, 10) = @day
    `),
    insertAiHistory: db.prepare(`
      INSERT INTO ai_history (
        id,
        job_id,
        document_id,
        user_id,
        action,
        prompt_label,
        request_json,
        output_text,
        status,
        error_code,
        error_message,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @jobId,
        @documentId,
        @userId,
        @action,
        @promptLabel,
        @requestJson,
        @outputText,
        @status,
        @errorCode,
        @errorMessage,
        @createdAt,
        @updatedAt
      )
    `),
    getAiHistoryByJobId: db.prepare(`
      SELECT
        id,
        job_id,
        document_id,
        user_id,
        action,
        prompt_label,
        request_json,
        output_text,
        status,
        error_code,
        error_message,
        created_at,
        updated_at
      FROM ai_history
      WHERE job_id = ?
    `),
    updateAiHistory: db.prepare(`
      UPDATE ai_history
      SET output_text = @outputText,
          status = @status,
          error_code = @errorCode,
          error_message = @errorMessage,
          updated_at = @updatedAt
      WHERE job_id = @jobId
    `),
    listAiHistoryForDocument: db.prepare(`
      SELECT
        id,
        job_id,
        document_id,
        action,
        prompt_label,
        output_text,
        status,
        error_message,
        created_at
      FROM ai_history
      WHERE document_id = ?
      ORDER BY created_at DESC
    `),
  };

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
    const queuedCount = statements.countQueuedAiJobsToday.get({ documentId, userId, day }).count;
    const historyCount = statements.countAiHistoryToday.get({ documentId, userId, day }).count;
    return queuedCount + historyCount;
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

  function recordAiJobFeedback({ actorUserId, documentId, jobId, disposition, appliedText = null, appliedRange = null }) {
    const recordedAt = nowIso();
    const historyRecord = getAiHistoryByJobId(jobId);

    if (historyRecord) {
      const normalizedOutput = (historyRecord.outputText || "").trim();
      const normalizedApplied = (appliedText || normalizedOutput).trim();
      const nextStatus =
        disposition === "rejected"
          ? "rejected"
          : normalizedApplied && normalizedApplied !== normalizedOutput
            ? "edited"
            : "accepted";

      statements.updateAiHistory.run({
        jobId,
        outputText: historyRecord.outputText,
        status: nextStatus,
        errorCode: historyRecord.errorCode,
        errorMessage: historyRecord.errorMessage,
        updatedAt: recordedAt,
      });
    }

    appendAuditLog(db, {
      actorUserId,
      documentId,
      actionType: "ai_job_feedback",
      metadata: {
        jobId,
        disposition,
        appliedText,
        appliedRange,
      },
    });

    return {
      jobId,
      disposition,
      recordedAt,
    };
  }

  function createAiHistory({ documentId, userId, action, promptLabel, requestPayload, status = "streaming" }) {
    const timestamp = nowIso();
    const historyId = makeId("aih");
    const jobId = makeId("aijob");

    statements.insertAiHistory.run({
      id: historyId,
      jobId,
      documentId,
      userId,
      action,
      promptLabel,
      requestJson: JSON.stringify(requestPayload),
      outputText: null,
      status,
      errorCode: null,
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    appendAuditLog(db, {
      actorUserId: userId,
      documentId,
      actionType: "ai_stream_started",
      metadata: { jobId, action },
    });

    return getAiHistoryByJobId(jobId);
  }

  function getAiHistoryByJobId(jobId) {
    const row = statements.getAiHistoryByJobId.get(jobId);
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      jobId: row.job_id,
      documentId: row.document_id,
      userId: row.user_id,
      action: row.action,
      promptLabel: row.prompt_label,
      request: parseJson(row.request_json, {}),
      outputText: row.output_text,
      status: row.status,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function completeAiHistory(jobId, outputText) {
    const existing = getAiHistoryByJobId(jobId);
    if (!existing) {
      return null;
    }

    statements.updateAiHistory.run({
      jobId,
      outputText,
      status: "completed",
      errorCode: null,
      errorMessage: null,
      updatedAt: nowIso(),
    });

    return getAiHistoryByJobId(jobId);
  }

  function failAiHistory(jobId, errorCode, errorMessage) {
    const existing = getAiHistoryByJobId(jobId);
    if (!existing) {
      return null;
    }

    statements.updateAiHistory.run({
      jobId,
      outputText: existing.outputText,
      status: "failed",
      errorCode,
      errorMessage,
      updatedAt: nowIso(),
    });

    return getAiHistoryByJobId(jobId);
  }

  function cancelAiHistory(jobId) {
    const existing = getAiHistoryByJobId(jobId);
    if (!existing) {
      return null;
    }

    if (existing.status !== "streaming") {
      return false;
    }

    statements.updateAiHistory.run({
      jobId,
      outputText: existing.outputText,
      status: "cancelled",
      errorCode: existing.errorCode,
      errorMessage: existing.errorMessage,
      updatedAt: nowIso(),
    });

    return true;
  }

  function listAiHistory(documentId) {
    return statements.listAiHistoryForDocument.all(documentId).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      action: row.action,
      promptLabel: row.prompt_label,
      outputPreview: (row.output_text || row.error_message || "").slice(0, 240),
      status: row.status,
      createdAt: row.created_at,
      jobId: row.job_id,
    }));
  }

  return {
    getAiPolicy,
    updateAiPolicy,
    countAiJobsToday,
    createAiJob,
    updateAiJob,
    getAiJob,
    createAiHistory,
    getAiHistoryByJobId,
    completeAiHistory,
    failAiHistory,
    cancelAiHistory,
    listAiHistory,
    recordAiJobFeedback,
  };
}

module.exports = {
  createAiRepository,
};
