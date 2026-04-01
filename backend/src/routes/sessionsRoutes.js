const express = require("express");
const { z } = require("zod");

const { validateBody } = require("../lib/validate");

const CreateSessionSchema = z.object({
  documentId: z.string().trim().min(1),
});

function sessionsRoutes({ sessionsService }) {
  const router = express.Router();

  router.post("/sessions", validateBody(CreateSessionSchema), (req, res, next) => {
    try {
      const response = sessionsService.createSession(req.auth, req.validatedBody.documentId);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { sessionsRoutes };
