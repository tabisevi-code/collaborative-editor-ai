"use strict";

const ALLOWED_AI_ERROR_CODES = new Set([
  "AI_FAILED",
  "AI_TIMEOUT",
  "QUOTA_EXCEEDED",
  "AI_ROLE_FORBIDDEN",
  "AI_DISABLED",
]);

/**
 * The AI layer returns only a small fixed set of error codes so the main
 * backend can map failures to a stable API contract without special-casing
 * individual providers.
 */
class AiServiceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "AiServiceError";
    this.code = ALLOWED_AI_ERROR_CODES.has(code) ? code : "AI_FAILED";
    this.details = details;
  }
}

function normalizeAiError(error) {
  if (error instanceof AiServiceError) {
    return error;
  }

  if (error && typeof error === "object" && ALLOWED_AI_ERROR_CODES.has(error.code)) {
    return new AiServiceError(error.code, error.message || error.code, error.details);
  }

  if (error && typeof error === "object" && error.name === "AbortError") {
    return new AiServiceError("AI_TIMEOUT", "AI request timed out");
  }

  return new AiServiceError("AI_FAILED", error?.message || "AI provider request failed");
}

module.exports = {
  ALLOWED_AI_ERROR_CODES,
  AiServiceError,
  normalizeAiError,
};
