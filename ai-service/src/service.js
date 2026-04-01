"use strict";

const { createAiLogger } = require("./logger");
const { makeAiJobId, nowIso } = require("./ids");
const { AiServiceError, normalizeAiError } = require("./errors");
const { insertAiJob, getAiJob, updateAiJob } = require("./store");

const ALLOWED_ACTIONS = new Set(["rewrite", "summarize", "translate"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCreateInput(input) {
  const issues = [];

  if (!isNonEmptyString(input.documentId)) {
    issues.push({
      path: "documentId",
      message: "documentId is required",
      code: "invalid_type",
    });
  }

  if (!ALLOWED_ACTIONS.has(input.action)) {
    issues.push({
      path: "action",
      message: "action must be rewrite, summarize, or translate",
      code: "invalid_enum",
    });
  }

  if (!input.selection || typeof input.selection !== "object") {
    issues.push({
      path: "selection",
      message: "selection is required",
      code: "invalid_type",
    });
  } else {
    if (!Number.isInteger(input.selection.start) || input.selection.start < 0) {
      issues.push({
        path: "selection.start",
        message: "selection.start must be >= 0",
        code: "invalid_type",
      });
    }

    if (!Number.isInteger(input.selection.end) || input.selection.end < 1) {
      issues.push({
        path: "selection.end",
        message: "selection.end must be >= 1",
        code: "invalid_type",
      });
    } else if (Number.isInteger(input.selection.start) && input.selection.end <= input.selection.start) {
      issues.push({
        path: "selection.end",
        message: "selection.end must be greater than selection.start",
        code: "custom",
      });
    }
  }

  if (!isNonEmptyString(input.requestId)) {
    issues.push({
      path: "requestId",
      message: "requestId is required",
      code: "invalid_type",
    });
  }

  if (!isNonEmptyString(input.baseVersionId)) {
    issues.push({
      path: "baseVersionId",
      message: "baseVersionId is required",
      code: "invalid_type",
    });
  }

  if (!isNonEmptyString(input.userId)) {
    issues.push({
      path: "userId",
      message: "userId is required",
      code: "invalid_type",
    });
  }

  if (typeof input.selectedText !== "string" || input.selectedText.length === 0) {
    issues.push({
      path: "selectedText",
      message: "selectedText is required",
      code: "invalid_type",
    });
  }

  if (input.action === "translate" && !isNonEmptyString(input.targetLanguage)) {
    issues.push({
      path: "targetLanguage",
      message: "targetLanguage is required for translate",
      code: "custom",
    });
  }

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: {
      documentId: input.documentId.trim(),
      action: input.action,
      selection: {
        start: input.selection.start,
        end: input.selection.end,
      },
      instruction: isNonEmptyString(input.instruction) ? input.instruction.trim() : undefined,
      targetLanguage: isNonEmptyString(input.targetLanguage) ? input.targetLanguage.trim() : undefined,
      requestId: input.requestId.trim(),
      baseVersionId: input.baseVersionId.trim(),
      userId: input.userId.trim(),
      selectedText: input.selectedText,
      contextBefore: typeof input.contextBefore === "string" ? input.contextBefore : "",
      contextAfter: typeof input.contextAfter === "string" ? input.contextAfter : "",
    },
  };
}

/**
 * The public job snapshot intentionally excludes the raw selection/context
 * payload because callers only need stable job metadata and the suggestion
 * result. Internal fields remain stored privately for later execution.
 */
function toAiJobResponse(job) {
  const response = {
    jobId: job.jobId,
    status: job.status,
    baseVersionId: job.baseVersionId,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  if (job.proposedText) {
    response.proposedText = job.proposedText;
  }

  if (job.errorCode) {
    response.errorCode = job.errorCode;
  }

  if (job.errorMessage) {
    response.errorMessage = job.errorMessage;
  }

  return response;
}

function createAiService(options = {}) {
  if (!options.provider || typeof options.provider.generateText !== "function") {
    throw new Error("createAiService requires a provider with generateText(input)");
  }

  const logger = createAiLogger(options.logger);

  async function createAiJob(input) {
    const parsed = validateCreateInput(input);
    if (!parsed.success) {
      throw new AiServiceError("AI_FAILED", "invalid AI job input", {
        issues: parsed.issues,
      });
    }

    const now = nowIso();
    const job = {
      jobId: makeAiJobId(),
      documentId: parsed.data.documentId,
      action: parsed.data.action,
      selection: parsed.data.selection,
      instruction: parsed.data.instruction,
      targetLanguage: parsed.data.targetLanguage,
      requestId: parsed.data.requestId,
      baseVersionId: parsed.data.baseVersionId,
      userId: parsed.data.userId,
      selectedText: parsed.data.selectedText,
      contextBefore: parsed.data.contextBefore,
      contextAfter: parsed.data.contextAfter,
      status: "PENDING",
      proposedText: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      createdAt: now,
      updatedAt: now,
    };

    const insertedJob = insertAiJob(job);
    logger.info("ai_job_created", {
      jobId: insertedJob.jobId,
      action: insertedJob.action,
      documentId: insertedJob.documentId,
      baseVersionId: insertedJob.baseVersionId,
    });

    return insertedJob;
  }

  async function runAiJob(jobOrJobId) {
    const jobId = typeof jobOrJobId === "string" ? jobOrJobId : jobOrJobId?.jobId;
    if (!jobId) {
      throw new AiServiceError("AI_FAILED", "jobId is required to run AI job");
    }

    const currentJob = getAiJob(jobId);
    if (!currentJob) {
      throw new AiServiceError("AI_FAILED", `AI job ${jobId} was not found`);
    }

    const runningJob = updateAiJob(jobId, (job) => ({
      ...job,
      status: "RUNNING",
      updatedAt: nowIso(),
      errorCode: undefined,
      errorMessage: undefined,
    }));

    logger.info("ai_job_running", {
      jobId: runningJob.jobId,
      action: runningJob.action,
      requestId: runningJob.requestId,
    });

    try {
      const providerResult = await options.provider.generateText({
        action: runningJob.action,
        selectedText: runningJob.selectedText,
        contextBefore: runningJob.contextBefore,
        contextAfter: runningJob.contextAfter,
        instruction: runningJob.instruction,
        targetLanguage: runningJob.targetLanguage,
        requestId: runningJob.requestId,
      });

      if (!providerResult || typeof providerResult.proposedText !== "string" || providerResult.proposedText.trim() === "") {
        throw new AiServiceError("AI_FAILED", "provider returned an empty AI suggestion");
      }

      const succeededJob = updateAiJob(jobId, (job) => ({
        ...job,
        status: "SUCCEEDED",
        proposedText: providerResult.proposedText.trim(),
        updatedAt: nowIso(),
      }));

      logger.info("ai_job_succeeded", {
        jobId: succeededJob.jobId,
        action: succeededJob.action,
      });

      return succeededJob;
    } catch (error) {
      const normalizedError = normalizeAiError(error);
      const failedJob = updateAiJob(jobId, (job) => ({
        ...job,
        status: "FAILED",
        proposedText: undefined,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
        updatedAt: nowIso(),
      }));

      logger.error("ai_job_failed", {
        jobId: failedJob.jobId,
        action: failedJob.action,
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
      });

      return failedJob;
    }
  }

  async function getAiJobStatus(jobId) {
    if (typeof jobId !== "string" || jobId.trim().length === 0) {
      throw new AiServiceError("AI_FAILED", "jobId is required");
    }

    return getAiJob(jobId.trim());
  }

  return {
    createAiJob,
    runAiJob,
    getAiJobStatus,
    toAiJobResponse,
  };
}

module.exports = {
  createAiService,
  toAiJobResponse,
};
