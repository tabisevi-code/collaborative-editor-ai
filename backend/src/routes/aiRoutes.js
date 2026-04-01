const express = require("express");
const { z } = require("zod");

const { validateBody } = require("../lib/validate");

const SelectionSchema = z.object({
  start: z.number().int().min(0),
  end: z.number().int().positive(),
});

const RewriteSchema = z.object({
  documentId: z.string().trim().min(1),
  selection: SelectionSchema,
  selectedText: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  instruction: z.string().trim().min(1).max(200),
  baseVersionId: z.string().trim().min(1).max(128),
  requestId: z.string().trim().min(1).max(128),
});

const SummarizeSchema = z.object({
  documentId: z.string().trim().min(1),
  selection: SelectionSchema,
  selectedText: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  baseVersionId: z.string().trim().min(1).max(128),
  requestId: z.string().trim().min(1).max(128),
});

const TranslateSchema = z.object({
  documentId: z.string().trim().min(1),
  selection: SelectionSchema,
  selectedText: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  targetLanguage: z.string().trim().min(1).max(64),
  baseVersionId: z.string().trim().min(1).max(128),
  requestId: z.string().trim().min(1).max(128),
});

function aiRoutes({ aiService }) {
  const router = express.Router();

  router.post("/ai/rewrite", validateBody(RewriteSchema), (req, res, next) => {
    try {
      const response = aiService.createRewriteJob(req.auth, req.validatedBody);
      return res.status(202).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/ai/summarize", validateBody(SummarizeSchema), (req, res, next) => {
    try {
      const response = aiService.createSummarizeJob(req.auth, req.validatedBody);
      return res.status(202).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/ai/translate", validateBody(TranslateSchema), (req, res, next) => {
    try {
      const response = aiService.createTranslateJob(req.auth, req.validatedBody);
      return res.status(202).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/ai/jobs/:jobId", (req, res, next) => {
    try {
      const response = aiService.getJob(req.auth, req.params.jobId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { aiRoutes };
