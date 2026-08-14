import {
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
} from "../platformRuntimeConfig.js";
import { checkPlatformProductionReadinessFromEnv } from "./check.js";

export const runPlatformProductionReadinessCheck = async (): Promise<void> => {
  const report = await checkPlatformProductionReadinessFromEnv();
  console.log(formatPlatformProductionReadinessReport(report));
  process.exitCode = platformProductionReadinessExitCode(report);
};
