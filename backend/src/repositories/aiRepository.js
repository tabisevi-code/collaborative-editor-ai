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
    countAiJobsToday: db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_jobs
      WHERE document_id = @documentId
        AND user_id = @userId
        AND substr(created_at, 1, 10) = @day
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

  function recordAiJobFeedback({ actorUserId, documentId, jobId, disposition, appliedText = null, appliedRange = null }) {
    const recordedAt = nowIso();

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

  return {
    getAiPolicy,
    updateAiPolicy,
    countAiJobsToday,
    createAiJob,
    updateAiJob,
    getAiJob,
    recordAiJobFeedback,
  };
}

module.exports = {
  createAiRepository,
};
