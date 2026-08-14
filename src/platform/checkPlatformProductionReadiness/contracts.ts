export type PlatformDatabaseReadiness =
  | { status: "ready" }
  | { status: "unreachable" }
  | { status: "migration_check_failed" }
  | { status: "migrations_missing"; missingMigrationIds: readonly string[] };

export type PlatformDatabaseReadinessProbe = (
  databaseUrl: string,
) => Promise<PlatformDatabaseReadiness>;

export type PlatformDraftStorageReadinessProbe = (
  directory: string,
) => Promise<void>;

export interface PlatformProductionReadinessProbes {
  probeDatabase?: PlatformDatabaseReadinessProbe | undefined;
  probeDraftStorage?: PlatformDraftStorageReadinessProbe | undefined;
}
