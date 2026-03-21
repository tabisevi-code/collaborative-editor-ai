const express = require("express");

function healthRoutes() {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return router;
}

module.exports = { healthRoutes };
