"use strict";

const express = require("express");
const { z } = require("zod");

const { sendError } = require("../lib/errors");
const { logError, logInfo } = require("../lib/logger");
const { validateBody } = require("../lib/validate");
const { getUserId } = require("../services/documentsService");

const SelectionSchema = z
  .object({
    start: z.number().int().min(0, "selection.start must be >= 0"),
    end: z.number().int().min(1, "selection.end must be >= 1"),
  })
  .refine((value) => value.end > value.start, {
    message: "selection.end must be greater than selection.start",
    path: ["end"],
  });

const AiRequestBaseSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
  selection: SelectionSchema,
  selectedText: z.string().min(1, "selectedText is required"),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  instruction: z.string().trim().optional(),
  baseVersionId: z.string().trim().min(1, "baseVersionId is required"),
});

const RewriteRequestSchema = AiRequestBaseSchema;
const SummarizeRequestSchema = AiRequestBaseSchema;
const TranslateRequestSchema = AiRequestBaseSchema.extend({
  targetLanguage: z.string().trim().min(1, "targetLanguage is required"),
});

/**
 * This route layer intentionally stays thin. Auth, RBAC, quota, and document
 * mutation remain the main backend's responsibility, while this module only
 * forwards validated jobs to the isolated AI executor.
 */
function aiRoutes(options = {}) {
  if (!options.aiService) {
    throw new Error("aiRoutes requires an aiService instance");
  }

  const router = express.Router();

  function scheduleAiExecution(jobId) {
    setImmediate(() => {
      void options.aiService.runAiJob(jobId).catch((error) => {
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

  function createHandler(action, schema) {
    return [
      validateBody(schema),
      async (req, res, next) => {
        try {
          const userId = getUserId(req);
          const job = await options.aiService.createAiJob({
            ...req.validatedBody,
            action,
            requestId: req.requestId,
            userId,
          });

          logInfo("ai_job_enqueued", {
            jobId: job.jobId,
            action,
            requestId: req.requestId,
          });
          scheduleAiExecution(job.jobId);

          return res.status(202).json(options.aiService.toAiJobResponse(job));
        } catch (error) {
          return next(error);
        }
      },
    ];
  }

  router.post("/ai/rewrite", ...createHandler("rewrite", RewriteRequestSchema));
  router.post("/ai/summarize", ...createHandler("summarize", SummarizeRequestSchema));
  router.post("/ai/translate", ...createHandler("translate", TranslateRequestSchema));

  router.get("/ai/jobs/:jobId", async (req, res, next) => {
    try {
      const job = await options.aiService.getAiJobStatus(req.params.jobId);
      if (!job) {
        return sendError(res, 404, "NOT_FOUND", "AI job not found");
      }

      return res.status(200).json(options.aiService.toAiJobResponse(job));
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { aiRoutes };
