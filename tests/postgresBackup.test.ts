import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  criticalApplicationTables,
  createPostgresBackup,
  runPostgresBackupCli,
  type CriticalTableCounts,
  type PostgresBackupSourceSnapshot,
  type PostgresCommandInvocation,
} from "../scripts/backup-postgres.js";

describe("Postgres backup", () => {
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (temporaryDirectory !== undefined) {
      await rm(temporaryDirectory, { force: true, recursive: true });
      temporaryDirectory = undefined;
    }
  });

  const outputPath = async (): Promise<string> => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-postgres-backup-"));

    return join(temporaryDirectory, "mockd.dump");
  };

  const criticalTableCounts = (count = 0): CriticalTableCounts =>
    Object.fromEntries(criticalApplicationTables.map(table => [table, count]));

  const sourceSnapshot: PostgresBackupSourceSnapshot = {
    snapshotId: "00000003-0000001B-1",
    database: {
      databaseName: "mockd",
      databaseOid: "16384",
      serverAddress: "10.0.0.10",
      serverPort: 5432,
    },
    criticalTableCounts: {
      ...criticalTableCounts(),
      accounts: 14,
      leagues: 1,
      league_memberships: 14,
      league_seasons: 1,
      fantasy_teams: 14,
      players: 500,
      audit_events: 1,
      draft_rooms: 1,
      draft_room_sales: 6,
    },
  };

  const withSourceSnapshot = async <T>(
    _databaseUrl: string,
    operation: (snapshot: PostgresBackupSourceSnapshot) => Promise<T>,
  ): Promise<T> => operation(sourceSnapshot);

  it("creates a custom-format dump and SHA-256 manifest without exposing DATABASE_URL", async () => {
    const backupPath = await outputPath();
    const databaseUrl = "postgresql://mockd:super-secret@database.internal:5432/mockd";
    const invocations: PostgresCommandInvocation[] = [];

    const result = await createPostgresBackup({ databaseUrl, outputPath: backupPath }, {
      now: () => new Date("2026-08-11T14:30:00.000Z"),
      randomId: () => "fixed-id",
      withSourceSnapshot,
      runCommand: async invocation => {
        invocations.push(invocation);
        const fileArgument = invocation.args.find(argument => argument.startsWith("--file="));
        if (fileArgument === undefined) throw new Error("Expected pg_dump output path.");
        await writeFile(fileArgument.slice("--file=".length), "custom postgres dump", { mode: 0o600 });
      },
    });

    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({
      command: "pg_dump",
      args: [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--snapshot=${sourceSnapshot.snapshotId}`,
        expect.stringMatching(/^--file=/),
      ],
    });
    expect(invocations[0]?.args.join(" ")).not.toContain(databaseUrl);
    expect(invocations[0]?.env).toMatchObject({
      PGHOST: "database.internal",
      PGPORT: "5432",
      PGDATABASE: "mockd",
      PGUSER: "mockd",
      PGPASSWORD: "super-secret",
    });

    const manifestContent = await readFile(`${backupPath}.manifest.json`, "utf8");
    const manifest = JSON.parse(manifestContent);
    expect(manifest).toEqual({
      schemaVersion: 2,
      kind: "mockd-postgres-backup",
      createdAt: "2026-08-11T14:30:00.000Z",
      format: "pg_dump-custom",
      file: "mockd.dump",
      sizeBytes: 20,
      sha256: "1f0df2e7cfe891c4f35397801c31c8048c44f8c69b6a29b82c3053df399e54b8",
      sourceDatabase: sourceSnapshot.database,
      criticalTableCounts: sourceSnapshot.criticalTableCounts,
    });
    expect(manifestContent).not.toContain(databaseUrl);
    expect(manifestContent).not.toContain("super-secret");
    expect(manifestContent).not.toContain(sourceSnapshot.snapshotId);
    expect(result).toMatchObject({
      status: "completed",
      outputPath: backupPath,
      manifestPath: `${backupPath}.manifest.json`,
      manifest,
    });
  });

  it("fails before running pg_dump when either destination already exists", async () => {
    const backupPath = await outputPath();
    await writeFile(`${backupPath}.manifest.json`, "occupied", "utf8");
    const runCommand = vi.fn();

    await expect(createPostgresBackup({
      databaseUrl: "postgres://mockd:secret@database.internal/mockd",
      outputPath: backupPath,
    }, { runCommand })).rejects.toThrow("Backup manifest already exists");
    expect(runCommand).not.toHaveBeenCalled();
    await expect(readFile(`${backupPath}.manifest.json`, "utf8")).resolves.toBe("occupied");
  });

  it("removes temporary and final artifacts when pg_dump fails", async () => {
    const backupPath = await outputPath();

    await expect(createPostgresBackup({
      databaseUrl: "postgres://mockd:secret@database.internal/mockd",
      outputPath: backupPath,
    }, {
      randomId: () => "failed-id",
      withSourceSnapshot,
      runCommand: async () => {
        throw new Error("pg_dump exited with code 2.");
      },
    })).rejects.toThrow("pg_dump exited with code 2");

    await expect(readFile(backupPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(`${backupPath}.manifest.json`, "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(backupPath, "..", ".mockd.dump.failed-id.tmp"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails before pg_dump when the source does not contain the expected Mockd schema", async () => {
    const backupPath = await outputPath();
    const runCommand = vi.fn();

    await expect(createPostgresBackup({
      databaseUrl: "postgres://mockd:secret@database.internal/mockd",
      outputPath: backupPath,
    }, {
      withSourceSnapshot: async () => {
        throw new Error('Expected Mockd schema is absent: critical table "accounts" is missing.');
      },
      runCommand,
    })).rejects.toThrow('Expected Mockd schema is absent: critical table "accounts" is missing');

    expect(runCommand).not.toHaveBeenCalled();
    await expect(readFile(backupPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(`${backupPath}.manifest.json`, "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a schema-only source that has not been production provisioned", async () => {
    const backupPath = await outputPath();
    const runCommand = vi.fn();

    await expect(createPostgresBackup({
      databaseUrl: "postgres://mockd:secret@database.internal/mockd",
      outputPath: backupPath,
    }, {
      withSourceSnapshot: async (_databaseUrl, operation) => operation({
        ...sourceSnapshot,
        criticalTableCounts: criticalTableCounts(),
      }),
      runCommand,
    })).rejects.toThrow(/has not been production provisioned/i);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("rejects missing, malformed, and non-Postgres connection strings", async () => {
    const backupPath = await outputPath();
    const runCommand = vi.fn();

    await expect(createPostgresBackup({ databaseUrl: "", outputPath: backupPath }, { runCommand }))
      .rejects.toThrow("DATABASE_URL is required");
    await expect(createPostgresBackup({
      databaseUrl: "mysql://mockd:secret@database.internal/mockd",
      outputPath: backupPath,
    }, { runCommand })).rejects.toThrow("DATABASE_URL must be a postgres:// or postgresql:// URL");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("fails closed on unknown CLI options and emits a machine-readable error", async () => {
    const createBackup = vi.fn();
    const writeOutput = vi.fn();
    const writeError = vi.fn();

    const exitCode = await runPostgresBackupCli([
      "--output=/backups/mockd.dump",
      "--overwrite",
    ], {
      DATABASE_URL: "postgres://mockd:secret@database.internal/mockd",
    }, { createBackup, writeOutput, writeError });

    expect(exitCode).toBe(1);
    expect(createBackup).not.toHaveBeenCalled();
    expect(writeOutput).not.toHaveBeenCalled();
    expect(writeError).toHaveBeenCalledOnce();
    expect(JSON.parse(String(writeError.mock.calls[0]?.[0]))).toEqual({
      status: "failed",
      error: "Unknown backup option: --overwrite",
    });
  });
});
