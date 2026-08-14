import type { PlatformE2eRunConfig } from "./contracts.js";
import { runDeployedPlatformE2e } from "./deployedRun.js";
import { runLocalPlatformE2e } from "./localRun.js";
import { resolvePlatformE2eRunConfig } from "./runConfig.js";
import { platformE2eRunnerUsage } from "./runnerArguments.js";

export const runPlatformE2e = async (
  config: PlatformE2eRunConfig = resolvePlatformE2eRunConfig(),
): Promise<number> => {
  if (config.helpRequested) {
    console.log(platformE2eRunnerUsage);
    return 0;
  }
  return config.target === "deployed"
    ? await runDeployedPlatformE2e(config)
    : await runLocalPlatformE2e(config);
};
