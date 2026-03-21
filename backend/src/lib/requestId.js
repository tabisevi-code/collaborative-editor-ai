const crypto = require("crypto");

const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

function newRequestId() {
  return `req_${crypto.randomBytes(8).toString("hex")}`;
}

function normalizeRequestId(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return "";
  }

  const value = String(rawValue).trim();
  if (value.length === 0 || value.length > REQUEST_ID_MAX_LENGTH) {
    return "";
  }

  if (!REQUEST_ID_PATTERN.test(value)) {
    return "";
  }

  return value;
}

function requestIdMiddleware() {
  return (req, res, next) => {
    const incoming = normalizeRequestId(req.header("x-request-id"));

    req.requestId = incoming || newRequestId();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  };
}

module.exports = { requestIdMiddleware };
