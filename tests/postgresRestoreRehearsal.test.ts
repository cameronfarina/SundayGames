import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CriticalTableCounts,
  PostgresBackupManifest,
} from "../scripts/backup-postgres.js";
import { criticalApplicationTables } from "../scripts/backup-postgres.js";
import {
  rehearsePostgresRestore,
  runPostgresRestoreRehearsalCli,
  type PostgresDatabaseInspection,
  type PostgresRestoreRehearsalResult,
} from "../scripts/rehearse-postgres-restore.js";
import type { PostgresCommandInvocation } from "../scripts/backup-postgres.js";

describe("Postgres restore rehearsal", () => {
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (temporaryDirectory !== undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = undefined;
    }
  });

  const criticalTableCounts: CriticalTableCounts = {
    ...Object.fromEntries(criticalApplicationTables.map(table => [table, 0])),
    platform_schema_migrations: 4,
    platform_store_snapshots: 1,
    accounts: 14,
    leagues: 1,
    league_memberships: 14,
    league_seasons: 1,
    fantasy_teams: 14,
    roster_rule_sets: 1,
    players: 500,
    keeper_declarations: 7,
    historical_import_batches: 3,
    historical_draft_sales: 420,
    pricing_snapshots: 2,
    player_prices: 1_000,
    league_season_draft_setups: 1,
    draft_rooms: 1,
    draft_room_events: 8,
    draft_room_sales: 6,
    league_invitations: 4,
  };

  const sourceDatabase = {
    databaseName: "mockd_production",
    databaseOid: "16384",
    serverAddress: "10.0.0.10",
    serverPort: 5432,
  } as const;

  const backupFixture = async (): Promise<{
    backupPath: string;
    manifestPath: string;
    manifest: PostgresBackupManifest;
  }> => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-postgres-restore-"));
    const backupPath = join(temporaryDirectory, "mockd.dump");
    const content = "custom postgres dump";
    await writeFile(backupPath, content, { mode: 0o600 });
    const manifest: PostgresBackupManifest = {
      schemaVersion: 2,
      kind: "mockd-postgres-backup",
      createdAt: "2026-08-11T14:30:00.000Z",
      format: "pg_dump-custom",
      file: basename(backupPath),
      sizeBytes: Buffer.byteLength(content),
      sha256: createHash("sha256").update(content).digest("hex"),
      sourceDatabase,
      criticalTableCounts,
    };
    const manifestPath = `${backupPath}.manifest.json`;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });

    return { backupPath, manifestPath, manifest };
  };

  const sourceInspection: PostgresDatabaseInspection = {
    ...sourceDatabase,
    userTableCount: 28,
  };
  const targetInspection: PostgresDatabaseInspection = {
    databaseName: "mockd_restore_20260811",
    databaseOid: "32768",
    serverAddress: "10.0.1.20",
    serverPort: 5432,
    userTableCount: 0,
  };

  it("restores only after integrity and isolation checks, then runs compiled verification", async () => {
    const fixture = await backupFixture();
    const sourceDatabaseUrl = "postgres://mockd:source-secret@source.internal/mockd_production";
    const targetDatabaseUrl = "postgres://mockd:target-secret@target.internal/mockd_restore_20260811";
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

  it("rejects a manifest created from a different source database", async () => {
    const fixture = await backupFixture();
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

  it("rejects the source database as the target before connecting or restoring", async () => {
    const fixture = await backupFixture();
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
    const fixture = await backupFixture();
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
    const fixture = await backupFixture();
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

  it("rejects a same-size tampered backup before connecting to either database", async () => {
    const fixture = await backupFixture();
    await writeFile(fixture.backupPath, "Custom postgres dump", "utf8");
    const inspectDatabase = vi.fn();
    const runCommand = vi.fn();

    await expect(rehearsePostgresRestore({
      sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
      targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore",
      backupPath: fixture.backupPath,
    }, { inspectDatabase, runCommand })).rejects.toThrow("Backup SHA-256 does not match its manifest");
    expect(inspectDatabase).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("does not migrate or check readiness after pg_restore fails", async () => {
    const fixture = await backupFixture();
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
    const fixture = await backupFixture();
    const runCommand = vi.fn();
    const inspectCriticalTableCounts = vi.fn(async () => ({
      ...criticalTableCounts,
      accounts: 13,
    }));

    await expect(rehearsePostgresRestore({
      sourceDatabaseUrl: "postgres://mockd:secret@source.internal/mockd_production",
      targetDatabaseUrl: "postgres://mockd:secret@target.internal/mockd_restore_20260811",
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
    expect(inspectCriticalTableCounts).toHaveBeenCalledWith(
      "postgres://mockd:secret@target.internal/mockd_restore_20260811",
    );
  });

  it("emits one machine-readable success result", async () => {
    const result: PostgresRestoreRehearsalResult = {
      schemaVersion: 1,
      kind: "mockd-postgres-restore-rehearsal",
      status: "passed",
      startedAt: "2026-08-11T15:00:00.000Z",
      completedAt: "2026-08-11T15:02:30.000Z",
      backup: { file: "mockd.dump", sizeBytes: 20, sha256: "a".repeat(64) },
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
    };
    const writeOutput = vi.fn();
    const writeError = vi.fn();
    const rehearseRestore = vi.fn(async () => result);

    await expect(runPostgresRestoreRehearsalCli(["--backup=/backups/mockd.dump"], {
      DATABASE_URL: "postgres://mockd:source-secret@source.internal/mockd",
      MOCKD_RESTORE_TARGET_DATABASE_URL:
        "postgres://mockd:target-secret@target.internal/mockd_restore_20260811",
    }, { rehearseRestore, writeOutput, writeError })).resolves.toBe(0);

    expect(writeOutput).toHaveBeenCalledOnce();
    expect(JSON.parse(String(writeOutput.mock.calls[0]?.[0]))).toEqual(result);
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
});
