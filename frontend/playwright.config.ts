import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const FRONTEND_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(FRONTEND_DIR, "..");
const aiProvider = process.env.AI_STREAM_PROVIDER?.trim() || "stub";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `AI_STREAM_PROVIDER=${aiProvider} npm run dev:clean`,
    cwd: ROOT_DIR,
    url: "http://localhost:5173",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
