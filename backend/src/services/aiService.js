const { createHttpError } = require("../lib/errors");
const { ensureDocumentAccess } = require("./documentsService");

function buildStubAiResult(actionType, selectedText, payload) {
  if (actionType === "rewrite") {
    const instruction = payload.instruction?.trim() || "Rewrite";
    return `${instruction}: ${selectedText.trim()}`;
  }

  if (actionType === "summarize") {
    const summaryLength = Math.max(1, Math.ceil(selectedText.length * 0.3));
    return `Summary: ${selectedText.slice(0, summaryLength)}`;
  }

  return `[${payload.targetLanguage || "translated"}] ${selectedText.trim()}`;
}

function createAiService({ repository }) {
  function createJob(user, actionType, payload) {
    const document = ensureDocumentAccess(repository, user, payload.documentId, "editor");
    const policy = repository.getAiPolicy(payload.documentId);
    if (!policy.aiEnabled) {
      throw createHttpError(403, "AI_DISABLED", "AI is disabled for this document");
    }

    if (!policy.allowedRolesForAI.includes(document.role)) {
      throw createHttpError(403, "AI_ROLE_FORBIDDEN", "your role cannot invoke AI actions");
    }

    const today = new Date().toISOString().slice(0, 10);
    const currentUsage = repository.countAiJobsToday(payload.documentId, user.userId, today);
    if (currentUsage >= policy.dailyQuota) {
      throw createHttpError(429, "QUOTA_EXCEEDED", "daily AI quota exceeded", {
        dailyQuota: policy.dailyQuota,
      });
    }

    const selection = payload.selection;
    if (
      !selection ||
      typeof selection.start !== "number" ||
      typeof selection.end !== "number" ||
      selection.start < 0 ||
      selection.end <= selection.start ||
      selection.end > document.content.length
    ) {
      throw createHttpError(400, "INVALID_INPUT", "selection is invalid for the current document");
    }

    const selectedText = document.content.slice(selection.start, selection.end);
    const job = repository.createAiJob({
      documentId: payload.documentId,
      userId: user.userId,
      actionType,
      requestPayload: payload,
      baseVersionId: document.currentVersionId,
    });

    setTimeout(() => {
      try {
        repository.updateAiJob({
          jobId: job.jobId,
          status: "RUNNING",
        });

        const proposedText = buildStubAiResult(actionType, selectedText, payload);
        repository.updateAiJob({
          jobId: job.jobId,
          status: "SUCCEEDED",
          result: {
            proposedText,
            baseVersionId: document.currentVersionId,
          },
        });
      } catch (error) {
        repository.updateAiJob({
          jobId: job.jobId,
          status: "FAILED",
          errorCode: "AI_FAILED",
          errorMessage: error.message,
        });
      }
    }, 25);

    return {
      jobId: job.jobId,
      statusUrl: `/ai/jobs/${job.jobId}`,
    };
  }

  return {
    createRewriteJob(user, payload) {
      return createJob(user, "rewrite", payload);
    },

    createSummarizeJob(user, payload) {
      return createJob(user, "summarize", payload);
    },

    createTranslateJob(user, payload) {
      return createJob(user, "translate", payload);
    },

    getJob(user, jobId) {
      const job = repository.getAiJob(jobId);
      if (!job) {
        throw createHttpError(404, "NOT_FOUND", "AI job not found");
      }

      ensureDocumentAccess(repository, user, job.documentId, "viewer");
      return {
        jobId: job.jobId,
        status: job.status,
        result: job.result,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        baseVersionId: job.baseVersionId,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    },
  };
}

module.exports = { createAiService };
