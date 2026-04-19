const { createHttpError } = require("../lib/errors");
const { logError, logInfo } = require("../lib/logger");
const { ensureDocumentAccess } = require("./documentsService");
const { buildPromptLabel } = require("../../../ai-service/src");
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

function chunkText(value, chunkSize = 8) {
  const chunks = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }

  return chunks;
}

async function* toAsyncChunks(value) {
  if (!value) {
    return;
  }

  if (typeof value[Symbol.asyncIterator] === "function") {
    for await (const chunk of value) {
      yield chunk;
    }
    return;
  }

  if (typeof value[Symbol.iterator] === "function") {
    for (const chunk of value) {
      yield chunk;
    }
  }
}

function createAiService({ repository, provider }) {
  if (
    !provider ||
    (typeof provider.generateText !== "function" && typeof provider.streamText !== "function")
  ) {
    throw new Error("createAiService requires a provider with generateText(input) or streamText(input)");
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

  function buildProviderInput(actionType, payload, requestId) {
    return {
      action: actionType,
      selectedText: payload.selectedText,
      contextBefore: payload.contextBefore || "",
      contextAfter: payload.contextAfter || "",
      instruction: payload.instruction,
      targetLanguage: payload.targetLanguage,
      requestId,
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
      const providerInput = buildProviderInput(job.actionType, job.request, job.request.requestId);
      const providerResult = await provider.generateText(providerInput);

      if (
        !providerResult ||
        typeof providerResult.proposedText !== "string" ||
        providerResult.proposedText.trim() === ""
      ) {
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

  function createHistoryEntry(user, actionType, payload) {
    enforceAiAccess(user, payload);

    const requestPayload = {
      ...payload,
      action: actionType,
    };
    const promptLabel = buildPromptLabel({
      action: actionType,
      instruction: payload.instruction,
      targetLanguage: payload.targetLanguage,
    });

    const historyEntry = repository.createAiHistory({
      documentId: payload.documentId,
      userId: user.userId,
      action: actionType,
      promptLabel,
      requestPayload,
    });

    logInfo("ai_stream_created", {
      jobId: historyEntry.jobId,
      actionType,
      documentId: payload.documentId,
      baseVersionId: payload.baseVersionId,
    });

    return historyEntry;
  }

  async function* streamHistoryJob(historyEntry) {
    const providerInput = buildProviderInput(
      historyEntry.action,
      historyEntry.request,
      historyEntry.jobId
    );
    const chunks = [];

    try {
      const providerSource =
        typeof provider.streamText === "function"
          ? await provider.streamText(providerInput)
          : chunkText((await provider.generateText(providerInput)).proposedText || "");

      for await (const chunk of toAsyncChunks(providerSource)) {
        const currentHistory = repository.getAiHistoryByJobId(historyEntry.jobId);
        if (!currentHistory || currentHistory.status === "cancelled") {
          return;
        }

        const textChunk = typeof chunk === "string" ? chunk : String(chunk || "");
        if (!textChunk) {
          continue;
        }

        chunks.push(textChunk);
        yield {
          type: "token",
          jobId: historyEntry.jobId,
          text: textChunk,
        };
      }

      const currentHistory = repository.getAiHistoryByJobId(historyEntry.jobId);
      if (!currentHistory || currentHistory.status === "cancelled") {
        return;
      }

      const fullText = chunks.join("").trim();
      if (!fullText) {
        throw new Error("provider returned an empty AI suggestion");
      }

      repository.completeAiHistory(historyEntry.jobId, fullText);
      logInfo("ai_stream_completed", {
        jobId: historyEntry.jobId,
        actionType: historyEntry.action,
      });

      yield {
        type: "done",
        jobId: historyEntry.jobId,
        fullText,
      };
    } catch (error) {
      const currentHistory = repository.getAiHistoryByJobId(historyEntry.jobId);
      if (!currentHistory || currentHistory.status === "cancelled") {
        return;
      }

      const normalizedError = normalizeAiError(error);
      repository.failAiHistory(
        historyEntry.jobId,
        normalizedError.code,
        normalizedError.message
      );

      logError("ai_stream_failed", {
        jobId: historyEntry.jobId,
        actionType: historyEntry.action,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });

      yield {
        type: "error",
        jobId: historyEntry.jobId,
        code: normalizedError.code,
        message: normalizedError.message,
      };
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

    startRewriteStream(user, payload) {
      const historyEntry = createHistoryEntry(user, "rewrite", payload);
      return {
        jobId: historyEntry.jobId,
        stream: streamHistoryJob(historyEntry),
      };
    },

    startSummarizeStream(user, payload) {
      const historyEntry = createHistoryEntry(user, "summarize", payload);
      return {
        jobId: historyEntry.jobId,
        stream: streamHistoryJob(historyEntry),
      };
    },

    startTranslateStream(user, payload) {
      const historyEntry = createHistoryEntry(user, "translate", payload);
      return {
        jobId: historyEntry.jobId,
        stream: streamHistoryJob(historyEntry),
      };
    },

    cancelStreamJob(user, jobId) {
      const historyEntry = repository.getAiHistoryByJobId(jobId);
      if (!historyEntry) {
        const queuedJob = repository.getAiJob(jobId);
        if (!queuedJob) {
          throw createHttpError(404, "NOT_FOUND", "AI job not found");
        }

        ensureDocumentAccess(repository, user, queuedJob.documentId, "viewer");
        return {
          jobId,
          cancelled: false,
        };
      }

      ensureDocumentAccess(repository, user, historyEntry.documentId, "viewer");
      return {
        jobId,
        cancelled: Boolean(repository.cancelAiHistory(jobId)),
      };
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
      const historyEntry = repository.getAiHistoryByJobId(jobId);

      if (!job && !historyEntry) {
        throw createHttpError(404, "NOT_FOUND", "AI job not found");
      }

      const documentId = historyEntry?.documentId || job.documentId;
      ensureDocumentAccess(repository, user, documentId, "viewer");
      return repository.recordAiJobFeedback({
        actorUserId: user.userId,
        documentId,
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
