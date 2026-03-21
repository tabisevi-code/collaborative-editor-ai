const express = require("express");
const cors = require("cors");

const { requestIdMiddleware } = require("./lib/requestId");
const { requestLoggerMiddleware } = require("./lib/logger");
const { notFoundHandler, errorHandler } = require("./lib/errors");

const { healthRoutes } = require("./routes/healthRoutes");
const { documentsRoutes } = require("./routes/documentsRoutes");

function createApp(config) {
  if (!config || typeof config !== "object") {
    throw new Error("createApp requires a config object");
  }

  const app = express();
  app.disable("x-powered-by");

  app.use(cors());

  app.use(requestIdMiddleware());
  app.use(requestLoggerMiddleware());

  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use(healthRoutes());
  app.use(
    documentsRoutes({
      contentMaxBytes: config.documentContentMaxBytes,
    })
  );

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}

module.exports = { createApp };
