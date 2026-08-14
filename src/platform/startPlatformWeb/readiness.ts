import {
  inspectPlatformPostgresReadiness,
  probeWritableDraftToolsDirectory,
} from "../checkPlatformProductionReadiness.js";
import type { NodePostgresClient } from "../postgresClient.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";

type ReadinessConfig = Pick<
  PlatformRuntimeConfig,
  "draftToolsSessionDirectory" | "liveDraftDataMode"
>;

export const createPlatformWebReadinessProbe = (
  config: ReadinessConfig,
  postgresClient: NodePostgresClient | undefined,
): (() => Promise<boolean>) => async () => {
  if (config.liveDraftDataMode === "postgres" && postgresClient === undefined) return false;
  if (postgresClient !== undefined) {
    const readiness = await inspectPlatformPostgresReadiness(postgresClient);
    if (readiness.status !== "ready") return false;
  }

  try {
    await probeWritableDraftToolsDirectory(config.draftToolsSessionDirectory);
    return true;
  } catch {
    return false;
  }
};
