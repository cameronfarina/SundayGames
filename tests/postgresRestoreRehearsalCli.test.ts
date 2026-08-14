import { expect, it, vi } from "vitest";
import { runPostgresRestoreRehearsalCli } from "../scripts/rehearse-postgres-restore.js";
import { restoreResult } from "./postgresRestoreRehearsal/fixtures.js";

it("emits one machine-readable success result", async () => {
  const writeOutput = vi.fn();
  const writeError = vi.fn();
  const rehearseRestore = vi.fn(async () => restoreResult);

  await expect(runPostgresRestoreRehearsalCli(["--backup=/backups/mockd.dump"], {
    DATABASE_URL: "postgres://mockd:source-secret@source.internal/mockd",
    MOCKD_RESTORE_TARGET_DATABASE_URL:
      "postgres://mockd:target-secret@target.internal/mockd_restore_20260811",
  }, { rehearseRestore, writeOutput, writeError })).resolves.toBe(0);

  expect(writeOutput).toHaveBeenCalledOnce();
  expect(JSON.parse(String(writeOutput.mock.calls[0]?.[0]))).toEqual(restoreResult);
  expect(writeError).not.toHaveBeenCalled();
});

it("emits a redacted machine-readable failure result", async () => {
  const sourceDatabaseUrl = "postgres://mockd:source-secret@source.internal/mockd";
  const targetDatabaseUrl =
    "postgres://mockd:target-secret@target.internal/mockd_restore_20260811";
  const writeOutput = vi.fn();
  const writeError = vi.fn();

  const exitCode = await runPostgresRestoreRehearsalCli(["--backup=/backups/mockd.dump"], {
    DATABASE_URL: sourceDatabaseUrl,
    MOCKD_RESTORE_TARGET_DATABASE_URL: targetDatabaseUrl,
  }, {
    rehearseRestore: async () => {
      throw new Error(`Could not connect to ${sourceDatabaseUrl} or ${targetDatabaseUrl}.`);
    },
    writeOutput,
    writeError,
  });

  expect(exitCode).toBe(1);
  expect(writeOutput).not.toHaveBeenCalled();
  expect(writeError).toHaveBeenCalledOnce();
  const serializedResult = String(writeError.mock.calls[0]?.[0]);
  expect(JSON.parse(serializedResult)).toMatchObject({
    schemaVersion: 1,
    kind: "mockd-postgres-restore-rehearsal",
    status: "failed",
  });
  expect(serializedResult).not.toContain(sourceDatabaseUrl);
  expect(serializedResult).not.toContain(targetDatabaseUrl);
  expect(serializedResult).not.toContain("source-secret");
  expect(serializedResult).not.toContain("target-secret");
});
