const express = require("express");
const cors = require("cors");

const { requestIdMiddleware } = require("./lib/requestId");
const { requestLoggerMiddleware } = require("./lib/logger");
const { notFoundHandler, errorHandler } = require("./lib/errors");

const { healthRoutes } = require("./routes/healthRoutes");
const { documentsRoutes } = require("./routes/documentsRoutes");
const { aiRoutes } = require("./routes/aiRoutes");
const { logInfo, logError } = require("./lib/logger");
const { createAiService, createLmStudioProvider } = require("../../ai-service/src");

function createApp(config, dependencies = {}) {
  if (!config || typeof config !== "object") {
    throw new Error("createApp requires a config object");
  }

  const aiService =
    dependencies.aiService ||
    createAiService({
      provider: createLmStudioProvider({
        endpoint: config.aiProviderEndpoint,
        model: config.aiModel,
        timeoutMs: config.aiTimeoutMs,
      }),
      logger: {
        info: logInfo,
        error: logError,
      },
    });

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
  app.use(
    aiRoutes({
      aiService,
    })
  );

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}

module.exports = { createApp };
