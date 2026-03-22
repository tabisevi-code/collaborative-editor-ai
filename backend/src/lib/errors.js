const { logError } = require("./logger");

function sendError(res, status, code, message, details) {
  const payload = { error: { code, message } };
  if (details && typeof details === "object") payload.error.details = details;
  return res.status(status).json(payload);
}

function notFoundHandler() {
  return (req, res) =>
    sendError(res, 404, "NOT_FOUND", "route not found", {
      method: req.method,
      path: req.originalUrl,
    });
}

function isClientFacingError(err) {
  return (
    err &&
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 600 &&
    typeof err.code === "string" &&
    typeof err.message === "string"
  );
}

function toSafeErrorLog(err) {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }

  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    status: err.status,
    code: err.code,
  };
}

/**
 * Express error handler must have 4 args.
 * eslint-disable-next-line no-unused-vars
 */
function errorHandler() {
  return (err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err?.type === "entity.parse.failed") {
      return sendError(res, 400, "INVALID_JSON", "request body must be valid JSON");
    }

    if (err?.type === "entity.too.large") {
      return sendError(res, 413, "PAYLOAD_TOO_LARGE", "request body exceeds limit");
    }

    if (isClientFacingError(err)) {
      return sendError(res, err.status, err.code, err.message, err.details);
    }

    logError("unhandled_error", {
      requestId: req.requestId,
      error: toSafeErrorLog(err),
    });

    return sendError(res, 500, "INTERNAL_ERROR", "unexpected server error");
  };
}

module.exports = {
  sendError,
  notFoundHandler,
  errorHandler,
};
