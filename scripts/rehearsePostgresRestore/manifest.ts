import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import {
  criticalApplicationTables,
  type CriticalTableCounts,
  type PostgresBackupManifest,
  type PostgresDatabaseIdentity,
} from "../backup-postgres.js";

const isDatabaseIdentity = (value: unknown): value is PostgresDatabaseIdentity =>
  value !== null && typeof value === "object" &&
  "databaseName" in value && typeof value.databaseName === "string" &&
  value.databaseName.length > 0 &&
  "databaseOid" in value && typeof value.databaseOid === "string" &&
  /^\d+$/.test(value.databaseOid) &&
  "serverAddress" in value && typeof value.serverAddress === "string" &&
  value.serverAddress.length > 0 &&
  "serverPort" in value && typeof value.serverPort === "number" &&
  Number.isSafeInteger(value.serverPort) && value.serverPort > 0;

const isCriticalTableCounts = (value: unknown): value is CriticalTableCounts => {
  if (value === null || typeof value !== "object") return false;
  if (Object.keys(value).length !== criticalApplicationTables.length) return false;

  return criticalApplicationTables.every(table => {
    const count: unknown = Reflect.get(value, table);
    return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
  });
};

const isBackupManifest = (value: unknown): value is PostgresBackupManifest => {
  if (value === null || typeof value !== "object") return false;

  return "schemaVersion" in value && value.schemaVersion === 2 &&
    "kind" in value && value.kind === "mockd-postgres-backup" &&
    "format" in value && value.format === "pg_dump-custom" &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "file" in value && typeof value.file === "string" &&
    "sizeBytes" in value && typeof value.sizeBytes === "number" &&
    Number.isSafeInteger(value.sizeBytes) && value.sizeBytes > 0 &&
    "sha256" in value && typeof value.sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(value.sha256) &&
    "sourceDatabase" in value && isDatabaseIdentity(value.sourceDatabase) &&
    "criticalTableCounts" in value && isCriticalTableCounts(value.criticalTableCounts);
};

export const readAndVerifyBackup = async (
  backupPath: string,
  manifestPath: string,
  hashFile: (path: string) => Promise<string>,
): Promise<PostgresBackupManifest> => {
  const parsedManifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isBackupManifest(parsedManifest)) throw new Error("Backup manifest is invalid.");
  if (parsedManifest.file !== basename(backupPath)) {
    throw new Error("Backup file name does not match its manifest.");
  }

  const backupStats = await stat(backupPath);
  if (!backupStats.isFile()) throw new Error("Backup path is not a regular file.");
  if (backupStats.size !== parsedManifest.sizeBytes) {
    throw new Error("Backup size does not match its manifest.");
  }
  if (await hashFile(backupPath) !== parsedManifest.sha256) {
    throw new Error("Backup SHA-256 does not match its manifest.");
  }

  return parsedManifest;
};

export const assertCriticalTableCountsMatch = (
  expected: CriticalTableCounts,
  actual: CriticalTableCounts,
): void => {
  const mismatches = criticalApplicationTables.flatMap(table =>
    expected[table] === actual[table]
      ? []
      : [`${table} expected ${expected[table]}, restored ${actual[table]}`]
  );
  if (mismatches.length > 0) {
    throw new Error(`Critical table counts do not match backup manifest: ${mismatches.join("; ")}.`);
  }
};
