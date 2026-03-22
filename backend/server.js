const { createApp } = require("./src/app");
const { loadConfig } = require("./src/config");
const { logInfo, logError } = require("./src/lib/logger");

function startServer() {
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
    });
  });
}

startServer();
