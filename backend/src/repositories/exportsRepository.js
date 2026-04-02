const { appendAuditLog } = require("../db/schema");
const { makeId, nowIso } = require("../lib/ids");
const { parseJson } = require("./repositoryUtils");

function createExportsRepository({ db }) {
  const statements = {
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
  };

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

  return {
    createExportJob,
    updateExportJob,
    getExportJob,
  };
}

module.exports = {
  createExportsRepository,
};
