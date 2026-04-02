import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "figures", "mermaid-src");
const outDir = path.join(root, "figures", "rendered");

const diagrams = [
  "c4-level-1-system-context.mmd",
  "c4-level-2-container.mmd",
  "c4-level-3-backend-components.mmd",
  "er-data-model.mmd",
  "sequence-document-open-and-sync.mmd",
  "sequence-ai-job-flow.mmd",
];

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  for (const file of diagrams) {
    const input = path.join(srcDir, file);
    const output = path.join(outDir, file.replace(/\.mmd$/, ".png"));
    await run(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["mmdc", "-i", input, "-o", output, "-b", "white", "-s", "2"],
      root
    );
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
