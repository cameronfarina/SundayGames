import { writeFile } from "node:fs/promises";
import { expect, it, onTestFinished, vi } from "vitest";
import { rehearsePostgresRestore } from "../scripts/rehearse-postgres-restore.js";
import {
  createBackupFixture,
  criticalTableCounts,
  sourceInspection,
  targetInspection,
} from "./postgresRestoreRehearsal/fixtures.js";

it("rejects a manifest created from a different source database", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const runCommand = vi.fn();

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
    targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore_20260811",
    backupPath: fixture.backupPath,
  }, {
    inspectDatabase: vi.fn()
      .mockResolvedValueOnce({ ...sourceInspection, databaseOid: "99999" })
      .mockResolvedValueOnce(targetInspection),
    inspectCriticalTableCounts: vi.fn(),
    runCommand,
  })).rejects.toThrow("Backup source database identity does not match DATABASE_URL");
  expect(runCommand).not.toHaveBeenCalled();
});

it("rejects a same-size tampered backup before connecting to either database", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  await writeFile(fixture.backupPath, "Custom postgres dump", "utf8");
  const inspectDatabase = vi.fn();
  const runCommand = vi.fn();

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
    targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore",
    backupPath: fixture.backupPath,
  }, { inspectDatabase, runCommand })).rejects.toThrow(
    "Backup SHA-256 does not match its manifest",
  );
  expect(inspectDatabase).not.toHaveBeenCalled();
  expect(runCommand).not.toHaveBeenCalled();
});

it("does not migrate or check readiness after pg_restore fails", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const runCommand = vi.fn(async () => {
    throw new Error("pg_restore exited with code 1.");
  });

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
    targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore_20260811",
    backupPath: fixture.backupPath,
  }, {
    inspectDatabase: vi.fn()
      .mockResolvedValueOnce(sourceInspection)
      .mockResolvedValueOnce(targetInspection),
    inspectCriticalTableCounts: vi.fn(),
    runCommand,
  })).rejects.toThrow("pg_restore exited with code 1");
  expect(runCommand).toHaveBeenCalledOnce();
});

it("fails after verification when restored critical record counts differ", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const runCommand = vi.fn();
  const inspectCriticalTableCounts = vi.fn(async () => ({
    ...criticalTableCounts,
    accounts: 13,
  }));
  const targetDatabaseUrl =
    "postgres://mockd:secret@target.internal/mockd_restore_20260811";

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
    targetDatabaseUrl,
    backupPath: fixture.backupPath,
  }, {
    inspectDatabase: vi.fn()
      .mockResolvedValueOnce(sourceInspection)
      .mockResolvedValueOnce(targetInspection),
    inspectCriticalTableCounts,
    runCommand,
  })).rejects.toThrow(
    "Critical table counts do not match backup manifest: accounts expected 14, restored 13.",
  );
  expect(runCommand).toHaveBeenCalledTimes(3);
  expect(inspectCriticalTableCounts).toHaveBeenCalledWith(targetDatabaseUrl);
});
