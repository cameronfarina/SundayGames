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
    const result = await client.query<{
      mode: PracticePersistenceMode;
      compatibility_snapshots_scrubbed: boolean;
    }>(
      `SELECT control.mode,
              NOT EXISTS (
                SELECT 1 FROM platform_store_snapshots
                WHERE COALESCE(snapshot_json->'mockDraftSessions', '[]'::jsonb) <> '[]'::jsonb
              ) AS compatibility_snapshots_scrubbed
       FROM platform_practice_persistence_control AS control
       WHERE control.singleton = true`,
    );
    const state = result.rows[0];
    return result.rows.length === 1 && state?.mode === expectedMode &&
      (expectedMode !== "normalized-only" || state.compatibility_snapshots_scrubbed);
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
