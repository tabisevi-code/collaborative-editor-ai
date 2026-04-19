const { createHttpError } = require("../lib/errors");
const { logError, logInfo } = require("../lib/logger");
const { ensureDocumentAccess } = require("./documentsService");
const { normalizeAiError } = require("../../../ai-service/src/errors");

function validateSelectionSnapshot(payload) {
  const selection = payload.selection;
  if (
    !selection ||
    typeof selection.start !== "number" ||
    typeof selection.end !== "number" ||
    !Number.isInteger(selection.start) ||
    !Number.isInteger(selection.end) ||
    selection.start < 0 ||
    selection.end <= selection.start
  ) {
    throw createHttpError(400, "INVALID_INPUT", "selection is invalid");
  }

  if (typeof payload.selectedText !== "string" || payload.selectedText.length === 0) {
    throw createHttpError(400, "INVALID_INPUT", "selectedText is required");
  }

  if (payload.selection.end - payload.selection.start !== payload.selectedText.length) {
    throw createHttpError(400, "INVALID_INPUT", "selectedText length does not match selection range");
  }

  if (!payload.baseVersionId || typeof payload.baseVersionId !== "string") {
    throw createHttpError(400, "INVALID_INPUT", "baseVersionId is required");
  }
}

function toAiJobResponse(job) {
  const response = {
    jobId: job.jobId,
    statusUrl: `/ai/jobs/${job.jobId}`,
    status: job.status,
    baseVersionId: job.baseVersionId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  if (job.result?.proposedText) {
    response.proposedText = job.result.proposedText;
  }

  if (job.errorCode) {
    response.errorCode = job.errorCode;
  }

  if (job.errorMessage) {
    response.errorMessage = job.errorMessage;
  }

  return response;
}

function createAiService({ repository, provider }) {
  if (!provider || typeof provider.generateText !== "function") {
    throw new Error("createAiService requires a provider with generateText(input)");
  }

  function enforceAiAccess(user, payload) {
    const document = ensureDocumentAccess(repository, user, payload.documentId, "viewer");
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

    validateSelectionSnapshot(payload);

    return {
      document,
      policy,
    };
  }

  function queueJobExecution(jobId) {
    setImmediate(() => {
      void runJob(jobId).catch((error) => {
        logError("ai_job_background_runner_failed", {
          jobId,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      });
    });
  }

  function createJob(user, actionType, payload) {
    enforceAiAccess(user, payload);

    const job = repository.createAiJob({
      documentId: payload.documentId,
      userId: user.userId,
      actionType,
      requestPayload: {
        ...payload,
        action: actionType,
      },
      baseVersionId: payload.baseVersionId,
    });

      logInfo("ai_job_created", {
        jobId: job.jobId,
        actionType,
        documentId: payload.documentId,
        baseVersionId: payload.baseVersionId,
        requestId: payload.requestId,
      });

    queueJobExecution(job.jobId);
    return toAiJobResponse(job);
  }

  async function runJob(jobId) {
    const job = repository.getAiJob(jobId);
    if (!job) {
      throw new Error(`AI job ${jobId} not found`);
    }

    repository.updateAiJob({
      jobId,
      status: "RUNNING",
    });

    try {
      const request = job.request;
      const providerResult = await provider.generateText({
        action: job.actionType,
        selectedText: request.selectedText,
        contextBefore: request.contextBefore || "",
        contextAfter: request.contextAfter || "",
        instruction: request.instruction,
        targetLanguage: request.targetLanguage,
        requestId: request.requestId,
      });

      if (!providerResult || typeof providerResult.proposedText !== "string" || providerResult.proposedText.trim() === "") {
        throw new Error("provider returned an empty AI suggestion");
      }

      const succeeded = repository.updateAiJob({
        jobId,
        status: "SUCCEEDED",
        result: {
          proposedText: providerResult.proposedText.trim(),
        },
      });

      logInfo("ai_job_succeeded", {
        jobId,
        actionType: job.actionType,
      });

      return succeeded;
    } catch (error) {
      const normalizedError = normalizeAiError(error);
      const failed = repository.updateAiJob({
        jobId,
        status: "FAILED",
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });

      logError("ai_job_failed", {
        jobId,
        actionType: job.actionType,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });

      return failed;
    }
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
      return toAiJobResponse(job);
    },

    recordJobFeedback(user, jobId, payload) {
      const job = repository.getAiJob(jobId);
      if (!job) {
        throw createHttpError(404, "NOT_FOUND", "AI job not found");
      }

      ensureDocumentAccess(repository, user, job.documentId, "viewer");
      return repository.recordAiJobFeedback({
        actorUserId: user.userId,
        documentId: job.documentId,
        jobId,
        disposition: payload.disposition,
        appliedText: payload.appliedText,
        appliedRange: payload.appliedRange,
      });
    },

    async runJobForTests(jobId) {
      const job = await runJob(jobId);
      return toAiJobResponse(job);
    },
  };
}

module.exports = {
  createAiService,
  toAiJobResponse,
};
