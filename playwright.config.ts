import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4319";
const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const isCi = process.env.CI === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // A single flaky auction timing failure rolls production back, so CI retries
  // before reporting red. Local runs never retry, to keep flakes visible.
  retries: isCi ? 2 : 0,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: isCi ? "dot" : "list",
  outputDir: "test-results/playwright",
  use: {
    baseURL,
    trace: isDeployedSmoke ? "off" : "retain-on-failure",
    screenshot: isDeployedSmoke ? "off" : "only-on-failure",
    video: isDeployedSmoke ? "off" : "retain-on-failure",
  },
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  }],
});
