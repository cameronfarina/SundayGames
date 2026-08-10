import { pathToFileURL } from "node:url";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
  type PlatformProductionReadinessReport,
} from "./platformRuntimeConfig.js";

export const checkPlatformProductionReadinessFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): PlatformProductionReadinessReport =>
  assessPlatformProductionReadiness(env);

const run = (): void => {
  const report = checkPlatformProductionReadinessFromEnv();
  console.log(formatPlatformProductionReadinessReport(report));
  process.exitCode = platformProductionReadinessExitCode(report);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
