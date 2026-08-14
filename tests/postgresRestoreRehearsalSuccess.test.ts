import { resolve } from "node:path";
import { expect, it, onTestFinished, vi } from "vitest";
import type { PostgresCommandInvocation } from "../scripts/backup-postgres.js";
import { rehearsePostgresRestore } from "../scripts/rehearse-postgres-restore.js";
import {
  createBackupFixture,
  criticalTableCounts,
  sourceInspection,
  targetInspection,
} from "./postgresRestoreRehearsal/fixtures.js";

it("restores only after integrity and isolation checks, then runs compiled verification", async () => {
  const fixture = await createBackupFixture();
  onTestFinished(fixture.remove);
  const sourceDatabaseUrl = "postgres://mockd:source-secret@source.internal/mockd_production";
  const targetDatabaseUrl =
    "postgres://mockd:target-secret@target.internal/mockd_restore_20260811";
  const invocations: PostgresCommandInvocation[] = [];
  const inspectDatabase = vi.fn(async (databaseUrl: string) =>
    databaseUrl === sourceDatabaseUrl ? sourceInspection : targetInspection
  );

  const result = await rehearsePostgresRestore({
    sourceDatabaseUrl,
    targetDatabaseUrl,
    backupPath: fixture.backupPath,
    projectRoot: process.cwd(),
  }, {
    inspectDatabase,
    inspectCriticalTableCounts: async () => criticalTableCounts,
    now: vi.fn()
      .mockReturnValueOnce(new Date("2026-08-11T15:00:00.000Z"))
      .mockReturnValueOnce(new Date("2026-08-11T15:02:30.000Z")),
    runCommand: async invocation => {
      invocations.push(invocation);
    },
  });

  expect(inspectDatabase).toHaveBeenNthCalledWith(1, sourceDatabaseUrl);
  expect(inspectDatabase).toHaveBeenNthCalledWith(2, targetDatabaseUrl);
  expect(invocations.map(invocation => invocation.command)).toEqual([
    "pg_restore",
    process.execPath,
    process.execPath,
  ]);
  expect(invocations[0]).toMatchObject({
    args: [
      "--format=custom",
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-privileges",
      "--dbname=mockd_restore_20260811",
      resolve(fixture.backupPath),
    ],
  });
  expect(invocations[0]?.env).toMatchObject({
    PGHOST: "target.internal",
    PGPORT: "5432",
    PGDATABASE: "mockd_restore_20260811",
    PGUSER: "mockd",
    PGPASSWORD: "target-secret",
  });
  expect(invocations[0]?.args.join(" ")).not.toContain(targetDatabaseUrl);
  expect(invocations[1]?.args).toEqual([
    resolve("dist/src/platform/runPlatformMigrations.js"),
  ]);
  expect(invocations[2]?.args).toEqual([
    resolve("dist/src/platform/checkPlatformProductionReadiness.js"),
  ]);
  expect(invocations[1]?.env.DATABASE_URL).toBe(targetDatabaseUrl);
  expect(invocations[2]?.env.DATABASE_URL).toBe(targetDatabaseUrl);
  expect(invocations[2]?.env.MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY)
    .toContain("mockd-restore-readiness-");
  expect(result).toEqual({
    schemaVersion: 1,
    kind: "mockd-postgres-restore-rehearsal",
    status: "passed",
    startedAt: "2026-08-11T15:00:00.000Z",
    completedAt: "2026-08-11T15:02:30.000Z",
    backup: {
      file: "mockd.dump",
      sizeBytes: fixture.manifest.sizeBytes,
      sha256: fixture.manifest.sha256,
    },
    target: {
      databaseName: "mockd_restore_20260811",
      criticalTableCounts,
    },
    checks: [
      "backup-integrity",
      "isolated-empty-target",
      "pg-restore",
      "compiled-migrations",
      "compiled-readiness",
      "critical-record-counts",
    ],
  });
  expect(JSON.stringify(result)).not.toContain("source-secret");
  expect(JSON.stringify(result)).not.toContain("target-secret");
  expect(JSON.stringify(result)).not.toContain("source.internal");
  expect(JSON.stringify(result)).not.toContain("target.internal");
});
