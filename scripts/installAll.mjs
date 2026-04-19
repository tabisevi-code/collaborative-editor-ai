import path from "node:path";

import { FASTAPI_DIR, listInstallTargets, printSection, pythonExecutable, ROOT_DIR, SERVICE_DEFINITIONS, runCommand, runNpmCommand } from "./utils.mjs";

async function main() {
  printSection(`Installing workspace dependencies from ${ROOT_DIR}`);

  const installTargets = await listInstallTargets();
  for (const service of installTargets) {
    await runNpmCommand({
      cwd: service.cwd,
      label: service.name,
      args: ["install"],
    });
  }

  const installedNames = new Set(installTargets.map((service) => service.name));
  for (const service of SERVICE_DEFINITIONS) {
    if (!installedNames.has(service.name)) {
      const relativePath = path.relative(ROOT_DIR, service.cwd) || service.name;
      process.stdout.write(`[${service.name}] skipped (no package.json in ${relativePath})\n`);
    }
  }

  await runCommand({
    command: pythonExecutable(),
    cwd: FASTAPI_DIR,
    label: "backend-fastapi",
    args: ["-m", "pip", "install", "-e", "."],
  });

  printSection("install:all completed");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
