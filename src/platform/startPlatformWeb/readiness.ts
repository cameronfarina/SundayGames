import {
  inspectPlatformPostgresReadiness,
  probeWritableDraftToolsDirectory,
} from "../checkPlatformProductionReadiness.js";
import type { NodePostgresClient } from "../postgresClient.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import type { PracticePersistenceMode } from "../practicePersistenceMode.js";

type ReadinessConfig = Pick<
  PlatformRuntimeConfig,
  "draftToolsSessionDirectory" | "liveDraftDataMode" | "practicePersistenceMode"
>;

export const practicePersistenceModeMatches = async (
  client: PostgresQueryClient,
  expectedMode: PracticePersistenceMode,
): Promise<boolean> => {
  try {
    const result = await client.query<{ mode: PracticePersistenceMode }>(
      `SELECT mode
       FROM platform_practice_persistence_control
       WHERE singleton = true`,
    );
    return result.rows.length === 1 && result.rows[0]?.mode === expectedMode;
  } catch {
    return false;
  }
};

export const createPlatformWebReadinessProbe = (
  config: ReadinessConfig,
  postgresClient: NodePostgresClient | undefined,
): (() => Promise<boolean>) => async () => {
  if (config.liveDraftDataMode === "postgres" && postgresClient === undefined) return false;
  if (postgresClient !== undefined) {
    const readiness = await inspectPlatformPostgresReadiness(postgresClient);
    if (readiness.status !== "ready") return false;
    if (!await practicePersistenceModeMatches(postgresClient, config.practicePersistenceMode)) {
      return false;
    }
  }

  try {
    await probeWritableDraftToolsDirectory(config.draftToolsSessionDirectory);
    return true;
  } catch {
    return false;
  }
};
