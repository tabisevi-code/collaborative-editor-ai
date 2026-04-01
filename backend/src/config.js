const path = require("path");

const DEFAULT_PORT = 3000;
const DEFAULT_JSON_BODY_LIMIT = "1mb";
const DEFAULT_DOCUMENT_CONTENT_MAX_BYTES = 200 * 1024;
const DEFAULT_DATABASE_PATH = path.resolve(process.cwd(), "data", "collaborative-editor-ai.sqlite");
const DEFAULT_REALTIME_WS_BASE_URL = "ws://localhost:3001/ws";
const DEFAULT_AUTH_TOKEN_TTL_SECONDS = 86400;
const DEFAULT_SESSION_TOKEN_TTL_SECONDS = 3600;
const DEFAULT_ALLOW_DEBUG_USER_HEADER = true;
const DEFAULT_AI_PROVIDER_ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions";
const DEFAULT_AI_MODEL = "local-model";
const DEFAULT_AI_TIMEOUT_MS = 15000;

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

function parseBoolean(rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallbackValue;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error("ALLOW_DEBUG_USER_HEADER must be a boolean value");
}

function parseNonEmptyString(rawValue, fallbackValue) {
  if (rawValue === undefined || rawValue === null) {
    return fallbackValue;
  }

  const trimmed = String(rawValue).trim();
  return trimmed.length > 0 ? trimmed : fallbackValue;
}

function loadConfig(env = process.env) {
  const databasePath = parseNonEmptyString(env.DATABASE_PATH, DEFAULT_DATABASE_PATH);

  return Object.freeze({
    port: parsePositiveInt(env.PORT, "PORT", DEFAULT_PORT),
    jsonBodyLimit: parseNonEmptyString(env.JSON_BODY_LIMIT, DEFAULT_JSON_BODY_LIMIT),
    documentContentMaxBytes: parsePositiveInt(
      env.DOCUMENT_CONTENT_MAX_BYTES,
      "DOCUMENT_CONTENT_MAX_BYTES",
      DEFAULT_DOCUMENT_CONTENT_MAX_BYTES
    ),
    databasePath,
    realtimeWsBaseUrl: parseNonEmptyString(env.REALTIME_WS_BASE_URL, DEFAULT_REALTIME_WS_BASE_URL),
    authTokenTtlSeconds: parsePositiveInt(
      env.AUTH_TOKEN_TTL_SECONDS,
      "AUTH_TOKEN_TTL_SECONDS",
      DEFAULT_AUTH_TOKEN_TTL_SECONDS
    ),
    sessionTokenTtlSeconds: parsePositiveInt(
      env.SESSION_TOKEN_TTL_SECONDS,
      "SESSION_TOKEN_TTL_SECONDS",
      DEFAULT_SESSION_TOKEN_TTL_SECONDS
    ),
    allowDebugUserHeader: parseBoolean(env.ALLOW_DEBUG_USER_HEADER, DEFAULT_ALLOW_DEBUG_USER_HEADER),
    realtimeSharedSecret: parseNonEmptyString(env.REALTIME_SHARED_SECRET, "collaborative-editor-ai-dev-secret"),
    aiProviderEndpoint: parseNonEmptyString(env.AI_PROVIDER_ENDPOINT, DEFAULT_AI_PROVIDER_ENDPOINT),
    aiModel: parseNonEmptyString(env.AI_MODEL, DEFAULT_AI_MODEL),
    aiTimeoutMs: parsePositiveInt(env.AI_TIMEOUT_MS, "AI_TIMEOUT_MS", DEFAULT_AI_TIMEOUT_MS),
  });
}

module.exports = { loadConfig };
