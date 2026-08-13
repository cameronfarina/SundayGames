import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4319";
const screenshotAnalysisBaseURL = process.env.MOCKD_E2E_SCREENSHOT_BASE_URL;
const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";
const screenshotAnalysisSpec = /platform-league-screenshot-analysis\.spec\.ts/u;

const chromiumProject = {
  name: "chromium",
  testIgnore: screenshotAnalysisSpec,
  use: { ...devices["Desktop Chrome"] },
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI === "true" ? "dot" : "list",
  outputDir: "test-results/playwright",
  use: {
    baseURL,
    trace: isDeployedSmoke ? "off" : "retain-on-failure",
    screenshot: isDeployedSmoke ? "off" : "only-on-failure",
    video: isDeployedSmoke ? "off" : "retain-on-failure",
  },
  projects: isDeployedSmoke || screenshotAnalysisBaseURL === undefined
    ? [chromiumProject]
    : [
        chromiumProject,
        {
          name: "screenshot-analysis",
          testMatch: screenshotAnalysisSpec,
          use: {
            ...devices["Desktop Chrome"],
            baseURL: screenshotAnalysisBaseURL,
          },
        },
      ],
});
