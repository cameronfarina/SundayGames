import { pathToFileURL } from "node:url";
import { runPlatformE2e } from "./platformE2e/run.js";

export type {
  DeployedPlatformSmokeConfig,
  PlatformE2eEnv,
  PlatformE2eFetch,
  PlatformE2eRunConfig,
  PlatformE2eTarget,
} from "./platformE2e/contracts.js";
export { platformE2eRunnerUsage } from "./platformE2e/runnerArguments.js";
export { resolvePlatformE2eRunConfig } from "./platformE2e/runConfig.js";
export { verifyDeployedPlatformSessionRoute } from "./platformE2e/sessionPreflight.js";
export { runPlatformE2e } from "./platformE2e/run.js";

const executablePath = process.argv[1];
if (executablePath !== undefined && import.meta.url === pathToFileURL(executablePath).href) {
  void runPlatformE2e().then(exitCode => {
    process.exitCode = exitCode;
  }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
