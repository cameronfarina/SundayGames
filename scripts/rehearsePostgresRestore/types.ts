import type {
  CriticalTableCounts,
  PostgresCommandRunner,
  PostgresDatabaseIdentity,
} from "../backup-postgres.js";

export interface PostgresDatabaseInspection extends PostgresDatabaseIdentity {
  userTableCount: number;
}

export interface RehearsePostgresRestoreOptions {
  sourceDatabaseUrl: string;
  targetDatabaseUrl: string;
  backupPath: string;
  manifestPath?: string | undefined;
  projectRoot?: string | undefined;
}

export interface RehearsePostgresRestoreDependencies {
  inspectDatabase?: ((databaseUrl: string) => Promise<PostgresDatabaseInspection>) | undefined;
  inspectCriticalTableCounts?: ((databaseUrl: string) => Promise<CriticalTableCounts>) | undefined;
  now?: (() => Date) | undefined;
  runCommand?: PostgresCommandRunner | undefined;
  sha256File?: ((path: string) => Promise<string>) | undefined;
}

export interface PostgresRestoreRehearsalResult {
  schemaVersion: 1;
  kind: "mockd-postgres-restore-rehearsal";
  status: "passed";
  startedAt: string;
  completedAt: string;
  backup: {
    file: string;
    sizeBytes: number;
    sha256: string;
  };
  target: {
    databaseName: string;
    criticalTableCounts: CriticalTableCounts;
  };
  checks: readonly [
    "backup-integrity",
    "isolated-empty-target",
    "pg-restore",
    "compiled-migrations",
    "compiled-readiness",
    "critical-record-counts",
  ];
}
