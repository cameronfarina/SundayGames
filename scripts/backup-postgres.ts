import { pathToFileURL } from "node:url";
import { runPostgresBackupCli } from "./postgres-backup/cli.js";

export {
  criticalApplicationTables,
  type CreatePostgresBackupDependencies,
  type CreatePostgresBackupOptions,
  type CriticalApplicationTable,
  type CriticalTableCounts,
  type PostgresBackupManifest,
  type PostgresBackupResult,
  type PostgresBackupSourceSnapshot,
  type PostgresCommandInvocation,
  type PostgresCommandRunner,
  type PostgresDatabaseIdentity,
  type PostgresSourceSnapshotRunner,
} from "./postgres-backup/contracts.js";
export { postgresCommandEnvironment } from "./postgres-backup/database-url.js";
export { inspectCriticalTableCounts } from "./postgres-backup/critical-tables.js";
export { withPostgresSourceSnapshot } from "./postgres-backup/source-snapshot.js";
export { runPostgresCommand, sha256File } from "./postgres-backup/commands.js";
export { createPostgresBackup } from "./postgres-backup/create-backup.js";
export { runPostgresBackupCli } from "./postgres-backup/cli.js";

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runPostgresBackupCli().then(exitCode => {
    process.exitCode = exitCode;
  });
}
