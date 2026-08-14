import { describe, expect, it, vi } from "vitest";
import {
  runPostgresBackupCli,
  type PostgresBackupResult,
} from "../scripts/backup-postgres.js";

const completedBackup: PostgresBackupResult = {
  status: "completed",
  outputPath: "/backups/argument.dump",
  manifestPath: "/backups/argument.dump.manifest.json",
  manifest: {
    schemaVersion: 2,
    kind: "mockd-postgres-backup",
    createdAt: "2026-08-14T12:00:00.000Z",
    format: "pg_dump-custom",
    file: "argument.dump",
    sizeBytes: 42,
    sha256: "a".repeat(64),
    sourceDatabase: {
      databaseName: "mockd",
      databaseOid: "16384",
      serverAddress: "10.0.0.10",
      serverPort: 5432,
    },
    criticalTableCounts: {},
  },
};

describe("Postgres backup CLI", () => {
  it("prefers the output argument over the environment fallback", async () => {
    const createBackup = vi.fn(async () => completedBackup);
    const writeOutput = vi.fn();

    const exitCode = await runPostgresBackupCli([
      "--output",
      "/backups/argument.dump",
    ], {
      DATABASE_URL: "postgres://mockd:secret@database.internal/mockd",
      MOCKD_POSTGRES_BACKUP_PATH: "/backups/environment.dump",
    }, { createBackup, writeOutput });

    expect(exitCode).toBe(0);
    expect(createBackup).toHaveBeenCalledWith({
      databaseUrl: "postgres://mockd:secret@database.internal/mockd",
      outputPath: "/backups/argument.dump",
    });
    expect(writeOutput).toHaveBeenCalledWith(JSON.stringify(completedBackup));
  });

  it("redacts connection strings from failures", async () => {
    const databaseUrl = "postgres://mockd:super-secret@database.internal/mockd";
    const writeError = vi.fn();

    const exitCode = await runPostgresBackupCli([], {
      DATABASE_URL: databaseUrl,
      MOCKD_POSTGRES_BACKUP_PATH: "/backups/environment.dump",
    }, {
      createBackup: async () => {
        throw new Error(`Could not back up ${databaseUrl} with super-secret`);
      },
      writeError,
    });

    expect(exitCode).toBe(1);
    expect(writeError).toHaveBeenCalledWith(JSON.stringify({
      status: "failed",
      error: "Could not back up [REDACTED] with super-secret",
    }));
  });
});
