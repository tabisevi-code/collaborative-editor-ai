const express = require("express");
const { z } = require("zod");

const { validateBody } = require("../lib/validate");

const CreateDocumentSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(120, "title too long"),
  content: z.string().optional().default(""),
});

const UpdateContentSchema = z.object({
  requestId: z.string().trim().min(1, "requestId is required").max(128),
  content: z.string(),
  baseRevisionId: z.string().trim().min(1, "baseRevisionId is required"),
});

const RevertSchema = z.object({
  requestId: z.string().trim().min(1, "requestId is required").max(128),
  targetVersionId: z.string().trim().min(1, "targetVersionId is required"),
});

const UpdatePermissionSchema = z.object({
  requestId: z.string().trim().min(1, "requestId is required").max(128),
  targetUserId: z.string().trim().min(1, "targetUserId is required").max(64),
  role: z.enum(["viewer", "editor"]),
});

const UpdateAiPolicySchema = z.object({
  aiEnabled: z.boolean(),
  allowedRolesForAI: z.array(z.enum(["owner", "editor", "viewer"])).min(1),
  dailyQuota: z.number().int().positive(),
});

function parsePositiveIntQuery(rawValue, fallbackValue) {
  if (!rawValue) {
    return fallbackValue;
  }

  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function documentsRoutes({ documentsService }) {
  const router = express.Router();

  router.post("/documents", validateBody(CreateDocumentSchema), (req, res, next) => {
    try {
      const response = documentsService.createDocument(req.auth, req.validatedBody);
      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/documents/:documentId", (req, res, next) => {
    try {
      const response = documentsService.getDocument(req.auth, req.params.documentId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/documents/:documentId/content", validateBody(UpdateContentSchema), (req, res, next) => {
    try {
      const response = documentsService.updateContent(req.auth, req.params.documentId, req.validatedBody);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/documents/:documentId/versions", (req, res, next) => {
    try {
      const response = documentsService.listVersions(req.auth, req.params.documentId, {
        limit: parsePositiveIntQuery(req.query.limit, 50),
        cursor: req.query.cursor || null,
      });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/documents/:documentId/revert", validateBody(RevertSchema), (req, res, next) => {
    try {
      const response = documentsService.revertDocument(req.auth, req.params.documentId, req.validatedBody);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/documents/:documentId/permissions", (req, res, next) => {
    try {
      const response = documentsService.listPermissions(req.auth, req.params.documentId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/documents/:documentId/permissions", validateBody(UpdatePermissionSchema), (req, res, next) => {
    try {
      const response = documentsService.updatePermission(req.auth, req.params.documentId, req.validatedBody);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/documents/:documentId/permissions/:targetUserId", (req, res, next) => {
    try {
      const response = documentsService.revokePermission(
        req.auth,
        req.params.documentId,
        req.params.targetUserId
      );
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/documents/:documentId/ai-policy", (req, res, next) => {
    try {
      const response = documentsService.getAiPolicy(req.auth, req.params.documentId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.put("/documents/:documentId/ai-policy", validateBody(UpdateAiPolicySchema), (req, res, next) => {
    try {
      const response = documentsService.updateAiPolicy(req.auth, req.params.documentId, req.validatedBody);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { documentsRoutes };
