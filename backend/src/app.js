const express = require("express");
const cors = require("cors");

const { createDatabase } = require("./db/database");
const { createAppRepository } = require("./repositories/appRepository");
const { createAuthService } = require("./services/authService");
const { createDocumentsService } = require("./services/documentsService");
const { createAiService } = require("./services/aiService");
const { createExportService } = require("./services/exportService");
const { createSessionsService } = require("./services/sessionsService");
const { createRequireAuthMiddleware } = require("./auth/authMiddleware");
const { requestIdMiddleware } = require("./lib/requestId");
const { requestLoggerMiddleware } = require("./lib/logger");
const { notFoundHandler, errorHandler } = require("./lib/errors");
const { authRoutes } = require("./routes/authRoutes");
const { healthRoutes } = require("./routes/healthRoutes");
const { documentsRoutes } = require("./routes/documentsRoutes");
const { aiRoutes } = require("./routes/aiRoutes");
const { exportRoutes } = require("./routes/exportRoutes");
const { sessionsRoutes } = require("./routes/sessionsRoutes");

function createApp(config) {
  if (!config || typeof config !== "object") {
    throw new Error("createApp requires a config object");
  }

  const db = createDatabase(config);
  const repository = createAppRepository(db);
  const authService = createAuthService({
    repository,
    authTokenTtlSeconds: config.authTokenTtlSeconds,
  });
  const documentsService = createDocumentsService({
    repository,
    contentMaxBytes: config.documentContentMaxBytes,
  });
  const aiService = createAiService({ repository });
  const exportService = createExportService({ repository });
  const sessionsService = createSessionsService({
    repository,
    realtimeWsBaseUrl: config.realtimeWsBaseUrl,
    realtimeSharedSecret: config.realtimeSharedSecret,
    sessionTokenTtlSeconds: config.sessionTokenTtlSeconds,
  });

  const app = express();
  app.disable("x-powered-by");
  app.locals.context = {
    db,
    repository,
    authService,
    documentsService,
    aiService,
    exportService,
    sessionsService,
  };

  app.use(cors());
  app.use(requestIdMiddleware());
  app.use(requestLoggerMiddleware());
  app.use(express.json({ limit: config.jsonBodyLimit }));

  app.use(healthRoutes());
  app.use(authRoutes({ authService }));

  const requireAuth = createRequireAuthMiddleware({
    authService,
    allowDebugUserHeader: config.allowDebugUserHeader,
  });

  app.use(requireAuth);
  app.use(documentsRoutes({ documentsService }));
  app.use(aiRoutes({ aiService }));
  app.use(exportRoutes({ exportService }));
  app.use(sessionsRoutes({ sessionsService }));

  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}

module.exports = { createApp };
