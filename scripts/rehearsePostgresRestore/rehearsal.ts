import { resolve } from "node:path";
import {
  inspectCriticalTableCounts,
  runPostgresCommand,
  sha256File,
} from "../backup-postgres.js";
import { runRestoreCommands } from "./commands.js";
import { inspectPostgresDatabase, inspectRestoreDatabases } from "./database.js";
import { restoreTargetEndpoint } from "./endpoints.js";
import { assertCriticalTableCountsMatch, readAndVerifyBackup } from "./manifest.js";
import type {
  PostgresRestoreRehearsalResult,
  RehearsePostgresRestoreDependencies,
  RehearsePostgresRestoreOptions,
} from "./types.js";

const checks: PostgresRestoreRehearsalResult["checks"] = [
  "backup-integrity",
  "isolated-empty-target",
  "pg-restore",
  "compiled-migrations",
  "compiled-readiness",
  "critical-record-counts",
];

export const rehearsePostgresRestore = async (
  options: RehearsePostgresRestoreOptions,
  dependencies: RehearsePostgresRestoreDependencies = {},
): Promise<PostgresRestoreRehearsalResult> => {
  const targetEndpoint = restoreTargetEndpoint(
    options.sourceDatabaseUrl,
    options.targetDatabaseUrl,
  );
  if (options.backupPath.trim().length === 0) throw new Error("Backup path is required.");

  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const backupPath = resolve(options.backupPath);
  const manifestPath = resolve(options.manifestPath ?? `${backupPath}.manifest.json`);
  const manifest = await readAndVerifyBackup(
    backupPath,
    manifestPath,
    dependencies.sha256File ?? sha256File,
  );
  const targetInspection = await inspectRestoreDatabases(
    options.sourceDatabaseUrl,
    options.targetDatabaseUrl,
    targetEndpoint.databaseName,
    manifest.sourceDatabase,
    dependencies.inspectDatabase ?? inspectPostgresDatabase,
  );
  await runRestoreCommands(
    options.targetDatabaseUrl,
    targetEndpoint.databaseName,
    backupPath,
    resolve(options.projectRoot ?? process.cwd()),
    dependencies.runCommand ?? runPostgresCommand,
  );
  const restoredCriticalTableCounts = await (
    dependencies.inspectCriticalTableCounts ?? inspectCriticalTableCounts
  )(options.targetDatabaseUrl);
  assertCriticalTableCountsMatch(manifest.criticalTableCounts, restoredCriticalTableCounts);

  return {
    schemaVersion: 1,
    kind: "mockd-postgres-restore-rehearsal",
    status: "passed",
    startedAt,
    completedAt: now().toISOString(),
    backup: {
      file: manifest.file,
      sizeBytes: manifest.sizeBytes,
      sha256: manifest.sha256,
    },
    target: {
      databaseName: targetInspection.databaseName,
      criticalTableCounts: restoredCriticalTableCounts,
    },
    checks,
  };
};
