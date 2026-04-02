import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

import { ROOT_DIR } from "./utils.mjs";

const require = createRequire(import.meta.url);
const { loadEnvFile } = require("../backend/src/lib/loadEnvFile");

const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const DEV_SCRIPT = path.join(ROOT_DIR, "scripts", "devAll.mjs");
const APP_PORTS = [3000, 3001, 5173];

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

function killExistingAppProcesses() {
  const seenPids = new Set();

  for (const port of APP_PORTS) {
    try {
      const output = execFileSync("lsof", ["-ti", `tcp:${port}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });

      for (const pid of output.split(/\s+/).filter(Boolean)) {
        if (seenPids.has(pid)) {
          continue;
        }

        seenPids.add(pid);
        process.kill(Number(pid), "SIGTERM");
        process.stdout.write(`[demo] stopped existing process ${pid} on port ${port}\n`);
      }
    } catch {
      // no process on that port
    }
  }
}

async function resolveAiProvider() {
  if (process.env.AI_PROVIDER?.trim()) {
    return process.env.AI_PROVIDER.trim();
  }

  try {
    const response = await fetch("http://127.0.0.1:1234/v1/models");
    if (response.ok) {
      process.stdout.write("[demo] detected LM Studio. Using AI_PROVIDER=lmstudio\n");
      return "lmstudio";
    }
  } catch {
    // fall back to stub below
  }

  process.stdout.write("[demo] LM Studio not detected. Using AI_PROVIDER=stub\n");
  return "stub";
}

async function main() {
  const databasePath = resolveDatabasePath();
  const aiProvider = await resolveAiProvider();
  killExistingAppProcesses();
  removeFileIfPresent(databasePath);
  removeFileIfPresent(`${databasePath}-wal`);
  removeFileIfPresent(`${databasePath}-shm`);

  const child = spawn(process.execPath, [DEV_SCRIPT], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      AI_PROVIDER: aiProvider,
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
