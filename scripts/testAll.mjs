import { FASTAPI_DIR, printSection, pythonExecutable, ROOT_DIR, runCommand, runNpmCommand } from "./utils.mjs";

const TEST_TARGETS = [
  { name: "backend-fastapi", runner: () => runCommand({ command: pythonExecutable(), cwd: FASTAPI_DIR, label: "backend-fastapi", args: ["-m", "pytest", "-q"] }) },
  { name: "frontend", cwd: `${ROOT_DIR}/frontend`, args: ["test"] },
  { name: "realtime", cwd: `${ROOT_DIR}/realtime`, args: ["test"] },
  { name: "root-integration", cwd: ROOT_DIR, args: ["run", "test:integration"] },
];

async function main() {
  printSection("Running monorepo test suite");
  const completedTargets = [];

  for (const target of TEST_TARGETS) {
    if (target.runner) {
      await target.runner();
    } else {
      await runNpmCommand({
        cwd: target.cwd,
        label: target.name,
        args: target.args,
      });
    }
    completedTargets.push(target.name);
  }

  printSection("Suite Summary");
  for (const target of completedTargets) {
    process.stdout.write(`- ${target}: PASS\n`);
  }

  printSection("test:all completed");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
