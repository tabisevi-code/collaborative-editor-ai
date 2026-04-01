const { createApp } = require("./src/app");
const { loadConfig } = require("./src/config");
const { logInfo, logError } = require("./src/lib/logger");
const { loadEnvFile } = require("./src/lib/loadEnvFile");
const path = require("node:path");

function startServer() {
  const envFilePath = path.join(__dirname, ".env");
  const envFileResult = loadEnvFile(envFilePath, process.env);
  if (envFileResult.loaded && envFileResult.loadedKeys.length > 0) {
    logInfo("env_file_loaded", {
      path: envFilePath,
      loadedKeys: envFileResult.loadedKeys,
    });
  }

  let config;
  try {
    config = loadConfig(process.env);
  } catch (err) {
    logError("invalid_config", {
      error: { message: err.message },
    });
    process.exit(1);
  }

  const app = createApp(config);

  app.listen(config.port, () => {
    logInfo("server_started", {
      port: config.port,
      url: `http://localhost:${config.port}`,
      databasePath: config.databasePath,
    });
  });
}

startServer();
