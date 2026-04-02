import { printSection, ROOT_DIR, runNpmCommand } from "./utils.mjs";

const TEST_TARGETS = [
  { name: "backend", cwd: `${ROOT_DIR}/backend`, args: ["test"] },
  { name: "frontend", cwd: `${ROOT_DIR}/frontend`, args: ["test"] },
  { name: "realtime", cwd: `${ROOT_DIR}/realtime`, args: ["test"] },
  { name: "root-integration", cwd: ROOT_DIR, args: ["run", "test:integration"] },
];

async function main() {
  printSection("Running monorepo test suite");
  const completedTargets = [];

  for (const target of TEST_TARGETS) {
    await runNpmCommand({
      cwd: target.cwd,
      label: target.name,
      args: target.args,
    });
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
