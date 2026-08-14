import { expect, it, onTestFinished, vi } from "vitest";
import { rehearsePostgresRestore } from "../scripts/rehearse-postgres-restore.js";
import {
  createBackupFixture,
  sourceInspection,
  targetInspection,
} from "./postgresRestoreRehearsal/fixtures.js";

it("rejects the source database as the target before connecting or restoring", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const inspectDatabase = vi.fn();
  const runCommand = vi.fn();

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://source-user:secret@database.internal:5432/mockd",
    targetDatabaseUrl: "postgresql://target-user:other@DATABASE.internal/mockd?sslmode=require",
    backupPath: fixture.backupPath,
  }, { inspectDatabase, runCommand })).rejects.toThrow(
    "Restore target must use a different host, port, or database name than DATABASE_URL",
  );
  expect(inspectDatabase).not.toHaveBeenCalled();
  expect(runCommand).not.toHaveBeenCalled();
});

it("rejects runtime identities with the same database name", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const runCommand = vi.fn();

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd",
    targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore_20260811",
    backupPath: fixture.backupPath,
  }, {
    inspectDatabase: vi.fn()
      .mockResolvedValueOnce(sourceInspection)
      .mockResolvedValueOnce({ ...targetInspection, databaseName: sourceInspection.databaseName }),
    runCommand,
  })).rejects.toThrow("resolved to the source database name");
  expect(runCommand).not.toHaveBeenCalled();
});

it("rejects a target containing user tables", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const runCommand = vi.fn();

  await expect(rehearsePostgresRestore({
    sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
    targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore_20260811",
    backupPath: fixture.backupPath,
  }, {
    inspectDatabase: vi.fn()
      .mockResolvedValueOnce(sourceInspection)
      .mockResolvedValueOnce({ ...targetInspection, userTableCount: 1 }),
    runCommand,
  })).rejects.toThrow("Restore target must be empty; found 1 user table");
  expect(runCommand).not.toHaveBeenCalled();
});
