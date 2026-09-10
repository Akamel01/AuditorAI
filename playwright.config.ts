import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: {
    // M2: allow environment-based baseURL seam
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.HARVEST_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL || process.env.HARVEST_BASE_URL ? undefined : {
    command: process.env.CI ? "npm run start" : "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
