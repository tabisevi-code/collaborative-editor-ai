const DEFAULT_PORT = 3000;
const DEFAULT_JSON_BODY_LIMIT = "1mb";
const DEFAULT_DOCUMENT_CONTENT_MAX_BYTES = 200 * 1024;

function parsePositiveInt(rawValue, envName, fallbackValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallbackValue;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer`);
  }

  return parsed;
}

function parseNonEmptyString(rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null) {
    return fallbackValue;
  }

  const trimmed = String(rawValue).trim();
  return trimmed.length > 0 ? trimmed : fallbackValue;
}

function loadConfig(env = process.env) {
  return Object.freeze({
    port: parsePositiveInt(env.PORT, "PORT", DEFAULT_PORT),
    jsonBodyLimit: parseNonEmptyString(env.JSON_BODY_LIMIT, DEFAULT_JSON_BODY_LIMIT),
    documentContentMaxBytes: parsePositiveInt(
      env.DOCUMENT_CONTENT_MAX_BYTES,
      "DOCUMENT_CONTENT_MAX_BYTES",
      DEFAULT_DOCUMENT_CONTENT_MAX_BYTES
    ),
  });
}

module.exports = { loadConfig };
