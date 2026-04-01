import process from "node:process";

import { printSection, SERVICE_DEFINITIONS, spawnNpmCommand } from "./utils.mjs";

const DEV_SERVICES = SERVICE_DEFINITIONS.filter((service) =>
  ["backend", "frontend", "realtime"].includes(service.name)
);

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
    const child = spawnNpmCommand({
      cwd: service.cwd,
      label: service.name,
      args: ["run", "dev"],
      env: process.env,
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
