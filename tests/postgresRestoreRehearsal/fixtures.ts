import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  criticalApplicationTables,
  type CriticalTableCounts,
  type PostgresBackupManifest,
  type PostgresDatabaseIdentity,
} from "../../scripts/backup-postgres.js";
import type {
  PostgresDatabaseInspection,
  PostgresRestoreRehearsalResult,
} from "../../scripts/rehearse-postgres-restore.js";

export const criticalTableCounts: CriticalTableCounts = {
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

export const sourceDatabase: PostgresDatabaseIdentity = {
  databaseName: "mockd_production",
  databaseOid: "16384",
  serverAddress: "10.0.0.10",
  serverPort: 5432,
};

export const sourceInspection: PostgresDatabaseInspection = {
  ...sourceDatabase,
  userTableCount: 28,
};

export const targetInspection: PostgresDatabaseInspection = {
  databaseName: "mockd_restore_20260811",
  databaseOid: "32768",
  serverAddress: "10.0.1.20",
  serverPort: 5432,
  userTableCount: 0,
};

export interface BackupFixture {
  backupPath: string;
  manifest: PostgresBackupManifest;
  remove: () => Promise<void>;
}

export const createBackupFixture = async (): Promise<BackupFixture> => {
  const directory = await mkdtemp(join(tmpdir(), "mockd-postgres-restore-"));
  const backupPath = join(directory, "mockd.dump");
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
  await writeFile(`${backupPath}.manifest.json`, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });

  return {
    backupPath,
    manifest,
    remove: () => rm(directory, { force: true, recursive: true }),
  };
};

export const restoreResult: PostgresRestoreRehearsalResult = {
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
