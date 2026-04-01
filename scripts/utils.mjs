import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

export const SERVICE_DEFINITIONS = [
  { name: "backend", cwd: path.join(ROOT_DIR, "backend") },
  { name: "frontend", cwd: path.join(ROOT_DIR, "frontend") },
  { name: "realtime", cwd: path.join(ROOT_DIR, "realtime") },
  { name: "ai-service", cwd: path.join(ROOT_DIR, "ai-service") },
];

export function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export async function hasPackageJson(directory) {
  try {
    await access(path.join(directory, "package.json"));
    return true;
  } catch {
    return false;
  }
}

export async function listInstallTargets() {
  const targets = [];
  for (const service of SERVICE_DEFINITIONS) {
    if (await hasPackageJson(service.cwd)) {
      targets.push(service);
    }
  }

  return targets;
}

function writePrefixedLines(stream, targetStream, prefix) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      targetStream.write(`[${prefix}] ${line}\n`);
    }
  });

  stream.on("end", () => {
    if (buffer) {
      targetStream.write(`[${prefix}] ${buffer}\n`);
    }
  });
}

export function spawnNpmCommand({ cwd, label, args, env = process.env }) {
  const child = spawn(npmExecutable(), args, {
    cwd,
    env,
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (child.stdout) {
    writePrefixedLines(child.stdout, process.stdout, label);
  }
  if (child.stderr) {
    writePrefixedLines(child.stderr, process.stderr, label);
  }

  return child;
}

export function runNpmCommand({ cwd, label, args, env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawnNpmCommand({ cwd, label, args, env });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
      reject(new Error(`${label} failed with ${suffix}`));
    });
  });
}

export function printSection(title) {
  process.stdout.write(`\n== ${title} ==\n`);
}
