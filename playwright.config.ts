import dotenv from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load .env.test first (committed, non-sensitive defaults), then .env (local overrides/secrets)
dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env" });

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Dev server is started per-test by e2e/fixtures/base.ts
  // Each test gets its own server + fresh DB file
});
