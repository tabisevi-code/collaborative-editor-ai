import process from "node:process";
import { randomBytes } from "node:crypto";

import { FASTAPI_DATABASE_PATH, FASTAPI_DATABASE_URL, FASTAPI_DIR, printSection, ROOT_DIR, pythonExecutable, spawnCommand, spawnNpmCommand } from "./utils.mjs";

function resolveSecret(value) {
  return value && value.trim() ? value.trim() : randomBytes(32).toString("hex");
}

const SHARED_REALTIME_SECRET = resolveSecret(process.env.REALTIME_SHARED_SECRET);
const JWT_SECRET_KEY = resolveSecret(process.env.JWT_SECRET_KEY);
const JWT_REFRESH_SECRET_KEY = resolveSecret(process.env.JWT_REFRESH_SECRET_KEY);
const SHARED_REALTIME_WS_BASE_URL = process.env.REALTIME_WS_BASE_URL || "ws://localhost:3001/ws";
const FRONTEND_DIR = `${ROOT_DIR}/frontend`;
const REALTIME_DIR = `${ROOT_DIR}/realtime`;

const children = [];
let shuttingDown = false;

async function resolveAiProvider() {
  if (process.env.AI_STREAM_PROVIDER?.trim()) {
    return process.env.AI_STREAM_PROVIDER.trim();
  }

  try {
    const response = await fetch("http://127.0.0.1:1234/v1/models");
    if (response.ok) {
      process.stdout.write("[dev-all] detected LM Studio. Using AI_STREAM_PROVIDER=lmstudio\n");
      return "lmstudio";
    }
  } catch {
    // fall back to stub below
  }

  process.stdout.write("[dev-all] LM Studio not detected. Using AI_STREAM_PROVIDER=stub\n");
  return "stub";
}

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => child.once("exit", resolve));
}

function stopAll(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGTERM");
    }
  }

  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }
  }, 2000);

  Promise.all(children.map(waitForExit)).finally(() => {
    clearTimeout(forceTimer);
    process.exit(exitCode);
  });
}

async function main() {
  printSection("Starting FastAPI backend, realtime, and frontend dev servers");
  const aiProvider = await resolveAiProvider();

  const serviceDefinitions = [
    {
      name: "backend-fastapi",
      start() {
        return spawnCommand({
          command: pythonExecutable(),
          cwd: FASTAPI_DIR,
          label: "backend-fastapi",
          args: ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
          env: {
            ...process.env,
            FASTAPI_DATABASE_URL,
            JWT_SECRET_KEY,
            JWT_REFRESH_SECRET_KEY,
            REALTIME_SHARED_SECRET: SHARED_REALTIME_SECRET,
            REALTIME_WS_BASE_URL: SHARED_REALTIME_WS_BASE_URL,
            AI_STREAM_PROVIDER: aiProvider,
          },
        });
      },
    },
    {
      name: "realtime",
      start() {
        return spawnNpmCommand({
          cwd: REALTIME_DIR,
          label: "realtime",
          args: ["run", "dev"],
          env: {
            ...process.env,
            DATABASE_PATH: FASTAPI_DATABASE_PATH,
            REALTIME_SHARED_SECRET: SHARED_REALTIME_SECRET,
          },
        });
      },
    },
    {
      name: "frontend",
      start() {
        return spawnNpmCommand({
          cwd: FRONTEND_DIR,
          label: "frontend",
          args: ["run", "dev"],
          env: {
            ...process.env,
            VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || "http://localhost:8000",
          },
        });
      },
    },
  ];

  for (const service of serviceDefinitions) {
    const child = service.start();

    child.on("error", (error) => {
      console.error(`[${service.name}] failed to start: ${error.message}`);
      stopAll(1);
    });

    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
      console.error(`[${service.name}] exited unexpectedly with ${reason}`);
      stopAll(code === 0 ? 0 : code || 1);
    });

    children.push(child);
  }

  process.on("SIGINT", () => stopAll(0));
  process.on("SIGTERM", () => stopAll(0));
}

main();
