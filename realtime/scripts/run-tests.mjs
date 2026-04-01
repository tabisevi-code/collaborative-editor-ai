import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REALTIME_DIR = path.resolve(SCRIPT_DIR, "..");
const TEST_FILE = path.join(REALTIME_DIR, "src", "server.test.js");
const TEST_TIMEOUT_MS = 30000;
const SUCCESS_EXIT_GRACE_MS = 500;

function countExpectedTests(source) {
  const matches = source.match(/\btest\(\s*["'`]/g);
  return matches ? matches.length : 0;
}

function forwardLines(stream, target, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      target.write(`${line}\n`);
      onLine(line);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      target.write(`${buffer}\n`);
      onLine(buffer);
    }
  });
}

async function main() {
  const testSource = await fs.readFile(TEST_FILE, "utf8");
  const expectedTests = countExpectedTests(testSource);
  if (expectedTests === 0) {
    throw new Error("realtime test wrapper could not detect any tests in src/server.test.js");
  }

  const child = spawn(process.execPath, ["--test", "src/server.test.js"], {
    cwd: REALTIME_DIR,
    stdio: ["inherit", "pipe", "pipe"],
  });

  let completedTests = 0;
  let sawFailure = false;
  let completionTimer = null;

  function scheduleSuccessfulShutdown() {
    if (completionTimer || completedTests < expectedTests || sawFailure) {
      return;
    }

    completionTimer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
      }
    }, SUCCESS_EXIT_GRACE_MS);

    if (typeof completionTimer.unref === "function") {
      completionTimer.unref();
    }
  }

  function handleLine(line) {
    if (/^ok\s+\d+\s+-/.test(line)) {
      completedTests += 1;
      scheduleSuccessfulShutdown();
      return;
    }

    if (/^not ok\s+\d+\s+-/.test(line)) {
      completedTests += 1;
      sawFailure = true;
    }
  }

  forwardLines(child.stdout, process.stdout, handleLine);
  forwardLines(child.stderr, process.stderr, handleLine);

  const globalTimeout = setTimeout(() => {
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }, TEST_TIMEOUT_MS);

  const exitOutcome = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      clearTimeout(globalTimeout);
      if (completionTimer) {
        clearTimeout(completionTimer);
      }

      resolve({ code, signal });
    });
  });

  if (!sawFailure && completedTests === expectedTests) {
    process.exit(0);
  }

  if (exitOutcome.signal) {
    throw new Error(`realtime tests exited via signal ${exitOutcome.signal}`);
  }

  process.exit(exitOutcome.code || 1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
