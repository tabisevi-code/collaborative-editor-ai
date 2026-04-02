import process from "node:process";
import path from "node:path";

import { printSection, ROOT_DIR, SERVICE_DEFINITIONS, spawnNpmCommand } from "./utils.mjs";

const DEV_SERVICES = SERVICE_DEFINITIONS.filter((service) =>
  ["backend", "frontend", "realtime"].includes(service.name)
);
const SHARED_DATABASE_PATH = path.join(ROOT_DIR, "backend", "data", "collaborative-editor-ai.sqlite");
const SHARED_REALTIME_SECRET = process.env.REALTIME_SHARED_SECRET || "collaborative-editor-ai-dev-secret";
const SHARED_REALTIME_WS_BASE_URL = process.env.REALTIME_WS_BASE_URL || "ws://localhost:3001/ws";

const children = [];
let shuttingDown = false;

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

function main() {
  printSection("Starting backend, realtime, and frontend dev servers");

  for (const service of DEV_SERVICES) {
    const serviceEnv = {
      ...process.env,
    };

    if (service.name === "backend") {
      serviceEnv.DATABASE_PATH = serviceEnv.DATABASE_PATH || SHARED_DATABASE_PATH;
      serviceEnv.REALTIME_SHARED_SECRET = SHARED_REALTIME_SECRET;
      serviceEnv.REALTIME_WS_BASE_URL = SHARED_REALTIME_WS_BASE_URL;
    }

    if (service.name === "realtime") {
      serviceEnv.DATABASE_PATH = serviceEnv.DATABASE_PATH || SHARED_DATABASE_PATH;
      serviceEnv.REALTIME_SHARED_SECRET = SHARED_REALTIME_SECRET;
    }

    if (service.name === "frontend") {
      serviceEnv.VITE_API_BASE_URL = serviceEnv.VITE_API_BASE_URL || "http://localhost:3000";
    }

    const child = spawnNpmCommand({
      cwd: service.cwd,
      label: service.name,
      args: ["run", "dev"],
      env: serviceEnv,
    });

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
