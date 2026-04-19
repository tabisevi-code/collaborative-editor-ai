import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { FASTAPI_DATABASE_PATH, FASTAPI_DATABASE_URL, ROOT_DIR } from "./utils.mjs";

const DEV_SCRIPT = path.join(ROOT_DIR, "scripts", "devAll.mjs");
const APP_PORTS = [8000, 3001, 5173];

function resolveDatabasePath() {
  const configuredUrl = process.env.FASTAPI_DATABASE_URL?.trim() || FASTAPI_DATABASE_URL;
  if (!configuredUrl.startsWith("sqlite:///")) {
    return FASTAPI_DATABASE_PATH;
  }

  return configuredUrl.slice("sqlite:///".length);
}

function removeFileIfPresent(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
    process.stdout.write(`[dev-clean] removed ${filePath}\n`);
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
        process.stdout.write(`[dev-clean] stopped existing process ${pid} on port ${port}\n`);
      }
    } catch {
      // no process on that port
    }
  }
}

async function resolveAiProvider() {
  if (process.env.AI_STREAM_PROVIDER?.trim()) {
    return process.env.AI_STREAM_PROVIDER.trim();
  }

  try {
    const response = await fetch("http://127.0.0.1:1234/v1/models");
    if (response.ok) {
      process.stdout.write("[dev-clean] detected LM Studio. Using AI_STREAM_PROVIDER=lmstudio\n");
      return "lmstudio";
    }
  } catch {
    // fall back to stub below
  }

  process.stdout.write("[dev-clean] LM Studio not detected. Using AI_STREAM_PROVIDER=stub\n");
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
      FASTAPI_DATABASE_URL: process.env.FASTAPI_DATABASE_URL || FASTAPI_DATABASE_URL,
      AI_STREAM_PROVIDER: aiProvider,
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
