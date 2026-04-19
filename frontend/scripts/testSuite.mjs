import { spawn } from "node:child_process";

const groups = [
  [
    "src/lib/paginatePlainText.test.ts",
    "src/lib/richTextToolbar.test.ts",
    "src/services/api.test.ts",
    "src/services/realtime.test.ts",
    "src/components/PagedPlainTextEditor.test.tsx",
  ],
  [
    "src/pages/LoginPage.test.tsx",
    "src/pages/RegisterPage.test.tsx",
    "src/pages/ForgotPasswordPage.test.tsx",
    "src/pages/HomePage.test.tsx",
    "src/App.test.tsx",
  ],
  [
    "src/components/AiPanel.test.tsx",
    "src/components/DocHeader.test.tsx",
    "src/components/ManagementPanels.test.tsx",
  ],
  ["src/pages/DocumentPage.test.tsx"],
];

function runGroup(files, index) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["vitest", "run", ...files],
      {
        stdio: "inherit",
        env: process.env,
      }
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`frontend test group ${index + 1} failed with ${signal ? `signal ${signal}` : `exit code ${code ?? 1}`}`));
    });
  });
}

for (const [index, files] of groups.entries()) {
  process.stdout.write(`\n== frontend test group ${index + 1}/${groups.length} ==\n`);
  // eslint-disable-next-line no-await-in-loop
  await runGroup(files, index);
}
