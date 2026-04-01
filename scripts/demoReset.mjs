import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import { ROOT_DIR } from "./utils.mjs";

const require = createRequire(import.meta.url);
const { loadEnvFile } = require("../backend/src/lib/loadEnvFile");

const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const DEV_SCRIPT = path.join(ROOT_DIR, "scripts", "devAll.mjs");

function resolveDatabasePath() {
  const env = { ...process.env };
  loadEnvFile(path.join(BACKEND_DIR, ".env"), env);

  const configuredPath = env.DATABASE_PATH?.trim();
  if (!configuredPath) {
    return path.join(BACKEND_DIR, "data", "collaborative-editor-ai.sqlite");
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(BACKEND_DIR, configuredPath);
}

function removeFileIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
    process.stdout.write(`[demo] removed ${filePath}\n`);
  }
}

async function main() {
  const databasePath = resolveDatabasePath();
  removeFileIfPresent(databasePath);
  removeFileIfPresent(`${databasePath}-wal`);
  removeFileIfPresent(`${databasePath}-shm`);

  const child = spawn(process.execPath, [DEV_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      AI_PROVIDER: process.env.AI_PROVIDER || "stub",
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main();
