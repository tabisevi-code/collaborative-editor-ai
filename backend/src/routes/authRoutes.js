const express = require("express");
const { z } = require("zod");

const { validateBody } = require("../lib/validate");

const LoginSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(120).optional(),
});

function authRoutes({ authService }) {
  const router = express.Router();

  router.post("/auth/login", validateBody(LoginSchema), (req, res, next) => {
    try {
      const response = authService.login(req.validatedBody);
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { authRoutes };
