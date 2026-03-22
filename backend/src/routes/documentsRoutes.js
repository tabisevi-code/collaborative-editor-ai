const express = require("express");
const { z } = require("zod");

const { sendError } = require("../lib/errors");
const { validateBody } = require("../lib/validate");
const {
  getUserId,
  computeRole,
  createDocument,
  fetchDocument,
} = require("../services/documentsService");

const DEFAULT_CONTENT_MAX_BYTES = 200 * 1024;

const CreateDocumentSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(120, "title too long"),
  content: z.string().optional().default(""),
});

function documentsRoutes(options = {}) {
  const router = express.Router();
  const contentMaxBytes = Number.isInteger(options.contentMaxBytes)
    ? options.contentMaxBytes
    : DEFAULT_CONTENT_MAX_BYTES;

  /**
   * POST /documents
   * Response 201:
   * { documentId, title, ownerId, createdAt, updatedAt, currentVersionId }
   */
  router.post("/documents", validateBody(CreateDocumentSchema), (req, res) => {
    const userId = getUserId(req);

    const { title, content } = req.validatedBody;

    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > contentMaxBytes) {
      return sendError(
        res,
        413,
        "PAYLOAD_TOO_LARGE",
        "content exceeds limit",
        { maxBytes: contentMaxBytes, actualBytes: bytes }
      );
    }

    const doc = createDocument({ title, content }, userId);

    return res.status(201).json({
      documentId: doc.documentId,
      title: doc.title,
      ownerId: doc.ownerId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      currentVersionId: doc.currentVersionId,
    });
  });

  /**
   * GET /documents/:documentId
   * Response 200:
   * { documentId, title, content, updatedAt, currentVersionId, role, revisionId }
   */
  router.get("/documents/:documentId", (req, res) => {
    const userId = getUserId(req);
    const { documentId } = req.params;

    const doc = fetchDocument(documentId);
    if (!doc) {
      return sendError(res, 404, "NOT_FOUND", "document not found");
    }

    const role = computeRole(userId, doc);

    return res.status(200).json({
      documentId: doc.documentId,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
      currentVersionId: doc.currentVersionId,
      role,
      revisionId: doc.revisionId,
    });
  });

  return router;
}

module.exports = { documentsRoutes };
