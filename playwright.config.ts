import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4319";
const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const isCi = process.env.CI === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // No retries: these cases share one platform store, so a second attempt
  // starts from the first attempt's data and fails for a different reason.
  // Timing races have to be fixed in the assertions instead.
  retries: 0,
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
