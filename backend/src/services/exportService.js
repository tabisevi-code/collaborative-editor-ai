const { createHttpError } = require("../lib/errors");
const { ensureDocumentAccess } = require("./documentsService");

const EXPORT_CONTENT_TYPES = {
  txt: "text/plain; charset=utf-8",
  json: "application/json; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function createExportPayload(document, format, jobId) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let content;

  if (format === "json") {
    content = JSON.stringify(
      {
        documentId: document.documentId,
        title: document.title,
        content: document.content,
        updatedAt: document.updatedAt,
      },
      null,
      2
    );
  } else {
    content = `Export format: ${format}\nTitle: ${document.title}\n\n${document.content}`;
  }

  return {
    downloadUrl: `/exports/${jobId}/download`,
    expiresAt,
    content,
    contentType: EXPORT_CONTENT_TYPES[format],
    fileName: `${document.documentId}.${format}`,
  };
}

function createExportService({ repository }) {
  return {
    createExportJob(user, documentId, format) {
      const document = ensureDocumentAccess(repository, user, documentId, "viewer");
      if (!EXPORT_CONTENT_TYPES[format]) {
        throw createHttpError(400, "INVALID_INPUT", "unsupported export format");
      }

      if (format === "txt" || format === "json") {
        const job = repository.createExportJob({
          documentId,
          userId: user.userId,
          format,
          initialStatus: "SUCCEEDED",
          result: {},
        });
        const result = createExportPayload(document, format, job.jobId);
        repository.updateExportJob({
          jobId: job.jobId,
          status: "SUCCEEDED",
          result,
        });
        return result;
      }

      const job = repository.createExportJob({
        documentId,
        userId: user.userId,
        format,
      });

      setTimeout(() => {
        try {
          repository.updateExportJob({
            jobId: job.jobId,
            status: "RUNNING",
          });

          repository.updateExportJob({
            jobId: job.jobId,
            status: "SUCCEEDED",
            result: createExportPayload(document, format, job.jobId),
          });
        } catch (error) {
          repository.updateExportJob({
            jobId: job.jobId,
            status: "FAILED",
            errorCode: "INTERNAL_ERROR",
            errorMessage: error.message,
          });
        }
      }, 25);

      return {
        jobId: job.jobId,
        statusUrl: `/exports/${job.jobId}`,
      };
    },

    getExportJob(user, jobId) {
      const job = repository.getExportJob(jobId);
      if (!job) {
        throw createHttpError(404, "NOT_FOUND", "export job not found");
      }

      ensureDocumentAccess(repository, user, job.documentId, "viewer");
      return {
        jobId: job.jobId,
        status: job.status,
        downloadUrl: job.result?.downloadUrl || null,
        expiresAt: job.result?.expiresAt || null,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      };
    },

    getExportDownload(user, jobId) {
      const job = repository.getExportJob(jobId);
      if (!job) {
        throw createHttpError(404, "NOT_FOUND", "export job not found");
      }

      ensureDocumentAccess(repository, user, job.documentId, "viewer");
      if (job.status !== "SUCCEEDED" || !job.result) {
        throw createHttpError(409, "CONFLICT", "export is not ready for download");
      }

      return job.result;
    },
  };
}

module.exports = { createExportService };
