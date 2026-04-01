const express = require("express");
const { z } = require("zod");

const { validateBody } = require("../lib/validate");

const CreateExportSchema = z.object({
  format: z.enum(["txt", "json", "pdf", "docx"]),
  requestId: z.string().trim().min(1).max(128).optional(),
});

function exportRoutes({ exportService }) {
  const router = express.Router();

  router.post("/documents/:documentId/export", validateBody(CreateExportSchema), (req, res, next) => {
    try {
      const response = exportService.createExportJob(
        req.auth,
        req.params.documentId,
        req.validatedBody.format
      );
      const statusCode = "jobId" in response ? 202 : 200;
      return res.status(statusCode).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/exports/:jobId", (req, res, next) => {
    try {
      const response = exportService.getExportJob(req.auth, req.params.jobId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/exports/:jobId/download", (req, res, next) => {
    try {
      const result = exportService.getExportDownload(req.auth, req.params.jobId);
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
      return res.status(200).send(result.content);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { exportRoutes };
