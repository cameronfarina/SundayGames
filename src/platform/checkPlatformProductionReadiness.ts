import { pathToFileURL } from "node:url";
import { runPlatformProductionReadinessCheck } from "./checkPlatformProductionReadiness/cli.js";

export type {
  PlatformDatabaseReadiness,
  PlatformDatabaseReadinessProbe,
  PlatformDraftStorageReadinessProbe,
  PlatformProductionReadinessProbes,
} from "./checkPlatformProductionReadiness/contracts.js";
export { checkPlatformProductionReadinessFromEnv } from "./checkPlatformProductionReadiness/check.js";
export { inspectPlatformPostgresReadiness } from "./checkPlatformProductionReadiness/database.js";
export { probeWritableDraftToolsDirectory } from "./checkPlatformProductionReadiness/draftStorage.js";

const executablePath = process.argv[1];
if (executablePath !== undefined && import.meta.url === pathToFileURL(executablePath).href) {
  void runPlatformProductionReadinessCheck();
}
