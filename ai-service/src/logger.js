"use strict";

/**
 * AI execution runs outside the main backend service layer, so it keeps a tiny
 * local logger instead of depending on backend-only modules. This keeps the
 * contract portable while still giving terminal-visible progress markers.
 */
function writeLog(level, message, fields = {}) {
  const event = {
    ts: new Date().toISOString(),
    level,
    scope: "ai-service",
    message,
    ...fields,
  };

  const line = JSON.stringify(event);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

function createAiLogger(overrides = {}) {
  return {
    info: overrides.info || ((message, fields) => writeLog("info", message, fields)),
    error: overrides.error || ((message, fields) => writeLog("error", message, fields)),
  };
}

module.exports = { createAiLogger };
