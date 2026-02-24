import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load .env.test first (committed, non-sensitive defaults), then .env (local overrides/secrets)
dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env" });

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
