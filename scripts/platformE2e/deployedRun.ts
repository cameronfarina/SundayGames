import { runChild } from "./childProcesses.js";
import type { PlatformE2eRunConfig } from "./contracts.js";
import { playwrightEnvironment } from "./playwrightEnvironment.js";
import { verifyDeployedPlatformSessionRoute } from "./sessionPreflight.js";

export const runDeployedPlatformE2e = async (
  config: PlatformE2eRunConfig,
): Promise<number> => {
  if (config.baseUrl === undefined) {
    throw new Error("--base-url or MOCKD_E2E_BASE_URL is required for deployed platform smoke.");
  }
  await verifyDeployedPlatformSessionRoute(
    config.baseUrl,
    fetch,
    config.deployedPreflightTimeoutMs,
  );
  console.log(
    `Running deployed platform smoke against ${config.baseUrl} `
    + `with pre-provisioned season ${config.deployedSmoke?.seasonId}.`,
  );
  return await runChild(
    "playwright",
    ["test", ...config.playwrightArgs],
    playwrightEnvironment(config),
  );
};
