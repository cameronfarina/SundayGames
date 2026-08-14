import { platformPostgresSchema } from "../../src/platform/postgresSchema.js";

export interface PostgresCommandInvocation {
  command: string;
  args: readonly string[];
  env: NodeJS.ProcessEnv;
}

export type PostgresCommandRunner = (
  invocation: PostgresCommandInvocation,
) => Promise<void>;

export const criticalApplicationTables: readonly string[] = [
  "platform_schema_migrations",
  "platform_store_snapshots",
  ...platformPostgresSchema.tables.map(table => table.name),
  "league_invitations",
];

export type CriticalApplicationTable = string;
export type CriticalTableCounts = Readonly<Record<CriticalApplicationTable, number>>;

export interface PostgresDatabaseIdentity {
  databaseName: string;
  databaseOid: string;
  serverAddress: string;
  serverPort: number;
}

export interface PostgresBackupSourceSnapshot {
  snapshotId: string;
  database: PostgresDatabaseIdentity;
  criticalTableCounts: CriticalTableCounts;
}

export type PostgresSourceSnapshotRunner = <T>(
  databaseUrl: string,
  operation: (snapshot: PostgresBackupSourceSnapshot) => Promise<T>,
) => Promise<T>;

export interface PostgresBackupManifest {
  schemaVersion: 2;
  kind: "mockd-postgres-backup";
  createdAt: string;
  format: "pg_dump-custom";
  file: string;
  sizeBytes: number;
  sha256: string;
  sourceDatabase: PostgresDatabaseIdentity;
  criticalTableCounts: CriticalTableCounts;
}

export interface CreatePostgresBackupOptions {
  databaseUrl: string;
  outputPath: string;
}

export interface CreatePostgresBackupDependencies {
  now?: (() => Date) | undefined;
  randomId?: (() => string) | undefined;
  runCommand?: PostgresCommandRunner | undefined;
  sha256File?: ((path: string) => Promise<string>) | undefined;
  withSourceSnapshot?: PostgresSourceSnapshotRunner | undefined;
}

export interface PostgresBackupResult {
  status: "completed";
  outputPath: string;
  manifestPath: string;
  manifest: PostgresBackupManifest;
}
