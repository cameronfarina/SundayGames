import { pathToFileURL } from "node:url";
import { runPlatformWebMain } from "./startPlatformWeb/processEntrypoint.js";

export type {
  StartedPlatformWebProcess,
  StartPlatformWebDependencies,
} from "./startPlatformWeb/contracts.js";
export { createPlatformWebReadinessProbe } from "./startPlatformWeb/readiness.js";
export { startPlatformWebFromEnv } from "./startPlatformWeb/start.js";

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPlatformWebMain();
}
