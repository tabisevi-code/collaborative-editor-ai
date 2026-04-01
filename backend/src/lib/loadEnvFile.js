"use strict";

const fs = require("node:fs");

/**
 * The backend currently reads configuration from process.env. This helper adds
 * lightweight `.env` support without introducing another runtime dependency.
 * Explicit shell environment variables still win, which keeps CI and local
 * overrides predictable.
 */
function loadEnvFile(filePath, env = process.env) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("loadEnvFile requires a file path");
  }

  if (!fs.existsSync(filePath)) {
    return {
      loaded: false,
      loadedKeys: [],
    };
  }

  const source = fs.readFileSync(filePath, "utf8");
  const loadedKeys = [];

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (env[key] !== undefined) {
      continue;
    }

    env[key] = value;
    loadedKeys.push(key);
  }

  return {
    loaded: true,
    loadedKeys,
  };
}

module.exports = { loadEnvFile };
