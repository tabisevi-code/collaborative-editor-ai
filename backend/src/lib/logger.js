function writeLog(level, msg, fields = {}) {
  const event = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };

  const line = JSON.stringify(event);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function logInfo(msg, fields) {
  writeLog("info", msg, fields);
}

function logError(msg, fields) {
  writeLog("error", msg, fields);
}

function requestLoggerMiddleware() {
  return (req, res, next) => {
    const startNs = process.hrtime.bigint();

    res.on("finish", () => {
      const endNs = process.hrtime.bigint();
      const durationMs = Number(endNs - startNs) / 1e6;

      logInfo("http_request", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });

    next();
  };
}

module.exports = {
  logInfo,
  logError,
  requestLoggerMiddleware,
};
