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

const StreamBaseSchema = z.object({
  documentId: z.string().trim().min(1),
  selection: SelectionSchema,
  selectedText: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  instruction: z.string().trim().min(1).max(200).optional(),
  baseVersionId: z.string().trim().min(1).max(128),
});

const RewriteStreamSchema = StreamBaseSchema;
const SummarizeStreamSchema = StreamBaseSchema;
const TranslateStreamSchema = StreamBaseSchema.extend({
  targetLanguage: z.string().trim().min(1).max(64),
});

const FeedbackSchema = z.object({
  disposition: z.enum(["applied_full", "applied_partial", "rejected"]),
  appliedText: z.string().optional(),
  appliedRange: SelectionSchema.optional(),
});

function encodeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function writeSseStream(req, res, aiService, createStream) {
  const session = createStream();
  let streamFinished = false;

  req.once("close", () => {
    if (streamFinished) {
      return;
    }

    try {
      aiService.cancelStreamJob(req.auth, session.jobId);
    } catch (_error) {
      // Client disconnects should not turn into a second response path.
    }
  });

  res.status(200);
  res.set({
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no",
  });

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  for await (const chunk of session.stream) {
    if (chunk.type === "token") {
      res.write(
        encodeSse("token", {
          jobId: chunk.jobId,
          text: chunk.text,
        })
      );
      continue;
    }

    if (chunk.type === "done") {
      res.write(
        encodeSse("done", {
          jobId: chunk.jobId,
          fullText: chunk.fullText,
        })
      );
      continue;
    }

    res.write(
      encodeSse("error", {
        jobId: chunk.jobId,
        code: chunk.code,
        message: chunk.message,
      })
    );
  }

  streamFinished = true;
  res.end();
}

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

  router.post("/ai/rewrite/stream", validateBody(RewriteStreamSchema), async (req, res, next) => {
    try {
      await writeSseStream(req, res, aiService, () =>
        aiService.startRewriteStream(req.auth, req.validatedBody)
      );
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  router.post("/ai/summarize/stream", validateBody(SummarizeStreamSchema), async (req, res, next) => {
    try {
      await writeSseStream(req, res, aiService, () =>
        aiService.startSummarizeStream(req.auth, req.validatedBody)
      );
      return undefined;
    } catch (error) {
      return next(error);
    }
  });

  router.post("/ai/translate/stream", validateBody(TranslateStreamSchema), async (req, res, next) => {
    try {
      await writeSseStream(req, res, aiService, () =>
        aiService.startTranslateStream(req.auth, req.validatedBody)
      );
      return undefined;
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

  router.post("/ai/jobs/:jobId/cancel", (req, res, next) => {
    try {
      const response = aiService.cancelStreamJob(req.auth, req.params.jobId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/ai/jobs/:jobId/feedback", validateBody(FeedbackSchema), (req, res, next) => {
    try {
      const response = aiService.recordJobFeedback(
        req.auth,
        req.params.jobId,
        req.validatedBody
      );
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { aiRoutes };
