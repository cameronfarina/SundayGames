import { randomUUID } from "node:crypto";
import { chmod, link, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { runPostgresCommand, sha256File } from "./commands.js";
import type {
  CreatePostgresBackupDependencies,
  CreatePostgresBackupOptions,
  PostgresBackupManifest,
  PostgresBackupResult,
} from "./contracts.js";
import { validateSourceSnapshot } from "./critical-tables.js";
import {
  databaseNameFromPostgresUrl,
  postgresCommandEnvironment,
} from "./database-url.js";
import { requireMissingPath } from "./files.js";
import { withPostgresSourceSnapshot } from "./source-snapshot.js";

export const createPostgresBackup = async (
  options: CreatePostgresBackupOptions,
  dependencies: CreatePostgresBackupDependencies = {},
): Promise<PostgresBackupResult> => {
  const expectedDatabaseName = databaseNameFromPostgresUrl(options.databaseUrl);
  if (options.outputPath.trim().length === 0) throw new Error("Backup output path is required.");

  const outputPath = resolve(options.outputPath);
  const manifestPath = `${outputPath}.manifest.json`;
  await requireMissingPath(outputPath, "Backup file");
  await requireMissingPath(manifestPath, "Backup manifest");

  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const randomId = (dependencies.randomId ?? randomUUID)();
  const temporaryOutputPath = join(outputDirectory, `.${basename(outputPath)}.${randomId}.tmp`);
  const temporaryManifestPath = `${temporaryOutputPath}.manifest.json`;
  const runCommand = dependencies.runCommand ?? runPostgresCommand;
  let publishedOutput = false;
  let publishedManifest = false;

  try {
    await requireMissingPath(temporaryOutputPath, "Temporary backup file");
    await requireMissingPath(temporaryManifestPath, "Temporary backup manifest");
    const sourceSnapshot = await (
      dependencies.withSourceSnapshot ?? withPostgresSourceSnapshot
    )(options.databaseUrl, async snapshot => {
      validateSourceSnapshot(snapshot, expectedDatabaseName);
      await runCommand({
        command: "pg_dump",
        args: [
          "--format=custom",
          "--no-owner",
          "--no-privileges",
          `--snapshot=${snapshot.snapshotId}`,
          `--file=${temporaryOutputPath}`,
        ],
        env: postgresCommandEnvironment(options.databaseUrl),
      });

      return snapshot;
    });
    await chmod(temporaryOutputPath, 0o600);

    const backupStats = await stat(temporaryOutputPath);
    if (!backupStats.isFile() || backupStats.size === 0) {
      throw new Error("pg_dump did not produce a non-empty backup file.");
    }

    const digest = await (dependencies.sha256File ?? sha256File)(temporaryOutputPath);
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Backup SHA-256 digest is invalid.");
    const manifest: PostgresBackupManifest = {
      schemaVersion: 2,
      kind: "mockd-postgres-backup",
      createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      format: "pg_dump-custom",
      file: basename(outputPath),
      sizeBytes: backupStats.size,
      sha256: digest,
      sourceDatabase: sourceSnapshot.database,
      criticalTableCounts: sourceSnapshot.criticalTableCounts,
    };
    await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });

    await link(temporaryOutputPath, outputPath);
    publishedOutput = true;
    await link(temporaryManifestPath, manifestPath);
    publishedManifest = true;

    return { status: "completed", outputPath, manifestPath, manifest };
  } catch (error) {
    if (publishedManifest) await rm(manifestPath, { force: true }).catch(() => undefined);
    if (publishedOutput) await rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await Promise.allSettled([
      rm(temporaryOutputPath, { force: true }),
      rm(temporaryManifestPath, { force: true }),
    ]);
  }
};
