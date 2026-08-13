import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { request as httpRequest, type ClientRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { CapturingAuthMailSender } from "../src/platform/auth.js";
import {
  InMemoryJobQueue,
  type CancelJobAtRunBoundaryInput,
  type CancelJobInput,
  type ClaimNextJobInput,
  type CompleteJobInput,
  type FailJobInput,
  type HeartbeatJobInput,
  type JobRecord,
  type JobRepository,
  type RerunJobInput,
  type SubmitJobInput,
  type UpdateJobProgressInput,
} from "../src/platform/jobs.js";
import {
  buildCurrentMockdLeagueSeason,
  defaultScoringSettings,
  type LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../src/platform/liveDraftRooms.js";
import {
  currentLeagueInitialRostersFor,
  loadCurrentPlayerCatalog,
} from "../src/platform/localDemoFixtures.js";
import { InMemoryLiveDraftRoomSetupRepository } from "../src/platform/liveDraftRoomSetups.js";
import {
  InMemoryHistoricalImportRepository,
  type HistoricalImportRepository,
} from "../src/platform/historicalImports.js";
import type {
  LeagueSetupRepository,
  RegisterLeagueSeasonRepositoryInput,
} from "../src/platform/leagueSetup.js";
import {
  dispatchNextPlatformJob,
  enqueueSimulationRunExecutionJob,
} from "../src/platform/platformJobOrchestrator.js";
import {
  createPlatformServer,
  liveDraftRoomRevisionNotificationFor,
  startPlatformServer,
  type PlatformServer,
} from "../src/platform/platformServer.js";
import { InMemoryPlatformStore } from "../src/platform/platformApp.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import {
  InMemorySimulationRepository,
  type CreateSimulationRequestInput,
  type SimulationMockBatchRunner,
  type SimulationRepository,
  type SimulationResult,
  type SimulationRun,
} from "../src/platform/simulations.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";
import { InMemoryPracticeShortlistRepository } from "../src/platform/practiceShortlists.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const completeInitialRostersFor = (
  season: LeagueSeason,
  openTeamId?: string,
): LiveDraftRoomInitialRosterPlayer[] => {
  const positions = [
    "QB", "QB", "QB", "RB", "RB", "RB", "RB", "WR",
    "WR", "WR", "WR", "WR", "TE", "TE", "K", "DST",
  ] as const;

  return season.teams.flatMap(team => positions
    .filter((_, index) => team.id !== openTeamId || index !== 11)
    .map((position, index) => ({
      teamId: team.id,
      playerName: `${team.id} ${position} ${index + 1}`,
      position,
      price: 1,
      expectedPrice: 1,
      source: "imported" as const,
    })));
};

const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}) => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

interface JsonFetchResult {
  status: number;
  contentType: string | null;
  setCookie?: string | null;
  retryAfter?: string | null;
  body: unknown;
}

const sessionTokenFrom = (response: JsonFetchResult): string => {
  const match = response.setCookie?.match(/(?:^|;\s*)mockd_session=([^;]+)/);
  if (match?.[1] === undefined) throw new Error("Expected a Mockd session cookie.");

  return decodeURIComponent(match[1]);
};

interface StoredSnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

interface StoredAuthAccountRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_verified_at: Date | null;
  auth_version: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface StoredAuthSessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  auth_version: number;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

interface DraftRoomRow {
  id: string;
  league_id: string;
  league_season_id: string;
  room_type: string;
  status: string;
  created_by_user_id: string;
  current_revision: number;
  starts_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface DraftRoomEventRow {
  id: string;
  draft_room_id: string;
  revision: number;
  sequence: number;
  event_type: string;
  actor_user_id: string;
  idempotency_key: string | null;
  mutation_hash: string | null;
  expected_revision: number | null;
  raw_command: string | null;
  payload_json: unknown;
  occurred_at: Date;
}

interface DraftRoomSnapshotRow {
  id: string;
  draft_room_id: string;
  revision: number;
  snapshot_json: unknown;
  snapshot_hash: string;
  created_at: Date;
}

interface DraftRoomSaleRow {
  id: string;
  draft_room_id: string;
  source_event_id: string;
  fantasy_team_id: string;
  player_name: string;
  normalized_player_name: string;
  position: string;
  price: number;
  expected_price: number | null;
  status: string;
  voided_by_event_id: string | null;
  created_at: Date;
}

interface DraftRoomExportRow {
  id: string;
  league_id: string;
  league_season_id: string;
  draft_room_id: string;
  created_by_user_id: string;
  artifact_type: string;
  status: string;
  storage_key: string | null;
  payload_hash: string;
  content_type: string;
  byte_length: number;
  source_revision: number;
  metadata_json: unknown;
  created_at: Date;
  completed_at: Date | null;
}

interface DraftRoomExportContentRow {
  id: string;
  artifact_id: string;
  content_base64: string;
  created_at: Date;
}

interface InsertGate {
  entered: () => void;
  release: Promise<void>;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneDate = (date: Date | null): Date | null =>
  date === null ? null : new Date(date.getTime());

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

const cloneAuthAccountRow = (row: StoredAuthAccountRow): StoredAuthAccountRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

const cloneAuthSessionRow = (row: StoredAuthSessionRow): StoredAuthSessionRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
  expires_at: new Date(row.expires_at.getTime()),
  revoked_at: row.revoked_at === null ? null : new Date(row.revoked_at.getTime()),
});

const cloneRoomRow = (row: DraftRoomRow): DraftRoomRow => ({
  ...row,
  starts_at: cloneDate(row.starts_at),
  started_at: cloneDate(row.started_at),
  ended_at: cloneDate(row.ended_at),
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

const cloneEventRow = (row: DraftRoomEventRow): DraftRoomEventRow => ({
  ...row,
  payload_json: jsonValue(row.payload_json),
  occurred_at: new Date(row.occurred_at.getTime()),
});

const cloneDraftRoomSnapshotRow = (row: DraftRoomSnapshotRow): DraftRoomSnapshotRow => ({
  ...row,
  snapshot_json: jsonValue(row.snapshot_json),
  created_at: new Date(row.created_at.getTime()),
});

const cloneSaleRow = (row: DraftRoomSaleRow): DraftRoomSaleRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});

const cloneExportRow = (row: DraftRoomExportRow): DraftRoomExportRow => ({
  ...row,
  metadata_json: jsonValue(row.metadata_json),
  created_at: new Date(row.created_at.getTime()),
  completed_at: cloneDate(row.completed_at),
});

const cloneContentRow = (row: DraftRoomExportContentRow): DraftRoomExportContentRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});

class FakePostgresClient implements PostgresQueryClient {
  row: StoredSnapshotRow | undefined;
  nextInsertGate: InsertGate | undefined;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE INDEX")) {
      return { rows: [] };
    }

    if (text.startsWith("SELECT revision, snapshot_json")) {
      return { rows: this.row === undefined ? [] : [this.row as TRow] };
    }

    if (text.startsWith("INSERT INTO platform_store_snapshots")) {
      if (this.nextInsertGate !== undefined) {
        const gate = this.nextInsertGate;
        this.nextInsertGate = undefined;
        gate.entered();
        await gate.release;
      }

      const [, nextRevisionValue, , snapshotJson, , expectedRevisionValue] = values;
      const nextRevision = Number(nextRevisionValue);
      const expectedRevision = Number(expectedRevisionValue);

      if (this.row === undefined) {
        if (expectedRevision !== 0) return { rows: [], rowCount: 0 };

        this.row = { revision: nextRevision, snapshot_json: snapshotJson };
        return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
      }

      if (this.row.revision !== expectedRevision) return { rows: [], rowCount: 0 };

      this.row = { revision: nextRevision, snapshot_json: snapshotJson };
      return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

class FakePostgresAuthClient implements PostgresQueryClient {
  readonly accounts = new Map<string, StoredAuthAccountRow>();
  readonly sessions = new Map<string, StoredAuthSessionRow>();

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("INSERT INTO accounts")) {
      const [id, email, passwordHash, emailVerifiedAt, createdAt] = values as readonly [
        string,
        string,
        string,
        Date,
        Date,
      ];
      const existing = [...this.accounts.values()].find(account => account.email_normalized === email);
      if (existing !== undefined) return { rows: [], rowCount: 0 };

      const row: StoredAuthAccountRow = {
        id,
        email,
        email_normalized: email,
        password_hash: passwordHash,
        email_verified_at: emailVerifiedAt,
        auth_version: 1,
        status: "active",
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.accounts.set(id, row);

      return { rows: [cloneAuthAccountRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE email_normalized = $1")) {
      const [email] = values as readonly [string];
      const activeOnly = normalizedSql.includes("status = 'active'");
      const row = [...this.accounts.values()]
        .find(account => account.email_normalized === email && (!activeOnly || account.status === "active"));

      return { rows: row === undefined ? [] : [cloneAuthAccountRow(row) as TRow] };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE id = $1")) {
      const [accountId] = values as readonly [string];
      const row = this.accounts.get(accountId);
      if (normalizedSql.includes("status = 'active'") && row?.status !== "active") {
        return { rows: [] };
      }

      return { rows: row === undefined ? [] : [cloneAuthAccountRow(row) as TRow] };
    }

    if (normalizedSql.startsWith("INSERT INTO sessions")) {
      const [id, accountId, tokenHash, expiresAt, createdAt, expectedPasswordHash] = values as readonly [
        string,
        string,
        string,
        Date,
        Date,
        string | undefined,
      ];
      const account = this.accounts.get(accountId);
      if (
        account === undefined ||
        (expectedPasswordHash !== undefined && (
          account.status !== "active" || account.password_hash !== expectedPasswordHash
        ))
      ) {
        return { rows: [], rowCount: 0 };
      }
      const row: StoredAuthSessionRow = {
        id,
        account_id: accountId,
        token_hash: tokenHash,
        auth_version: account.auth_version,
        created_at: createdAt,
        expires_at: expiresAt,
        revoked_at: null,
      };
      this.sessions.set(id, row);

      return { rows: [cloneAuthSessionRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.token_hash = $1")) {
      const [tokenHash] = values as readonly [string];
      const row = [...this.sessions.values()].find(session => {
        if (session.token_hash !== tokenHash) return false;
        const account = this.accounts.get(session.account_id);

        return account?.status === "active" && account.auth_version === session.auth_version;
      });

      return { rows: row === undefined ? [] : [cloneAuthSessionRow(row) as TRow] };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.id = $1")) {
      const [sessionId] = values as readonly [string];
      const row = this.sessions.get(sessionId);

      return { rows: row === undefined ? [] : [cloneAuthSessionRow(row) as TRow] };
    }

    if (normalizedSql.startsWith("UPDATE sessions SET revoked_at")) {
      const [sessionId, revokedAt] = values as readonly [string, Date];
      const row = this.sessions.get(sessionId);
      if (row === undefined) return { rows: [], rowCount: 0 };

      row.revoked_at = revokedAt;

      return { rows: [cloneAuthSessionRow(row) as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

class FakeTransactionalPostgresAuthClient
  extends FakePostgresAuthClient
  implements PostgresTransactionalQueryClient {
  readonly statements: string[] = [];
  readonly appliedMigrations = new Set<string>();

  override async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.statements.push(text);
    const normalizedSql = normalizeSql(text);

    if (
      normalizedSql.startsWith("CREATE TABLE") ||
      normalizedSql.startsWith("CREATE INDEX") ||
      normalizedSql.startsWith("CREATE UNIQUE INDEX") ||
      normalizedSql.startsWith("ALTER TABLE") ||
      normalizedSql.startsWith("DROP INDEX") ||
      normalizedSql.startsWith("UPDATE accounts SET email_verified_at")
    ) {
      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT id FROM platform_schema_migrations")) {
      const [migrationId] = values as readonly [string];

      return {
        rows: this.appliedMigrations.has(migrationId) ? [{ id: migrationId } as TRow] : [],
      };
    }

    if (normalizedSql.startsWith("INSERT INTO platform_schema_migrations")) {
      const [migrationId] = values as readonly [string];
      this.appliedMigrations.add(migrationId);

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
      return { rows: [] };
    }

    if (
      normalizedSql.includes("FROM draft_rooms") &&
      normalizedSql.includes("HAVING COUNT(*) > 1")
    ) {
      return { rows: [] };
    }

    return await super.query(text, values);
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }
}

class FakeTransactionalPostgresClient extends FakePostgresClient implements PostgresTransactionalQueryClient {
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

class FakeTransactionalPlatformPostgresClient
  extends FakePostgresClient
  implements PostgresTransactionalQueryClient {
  readonly rooms = new Map<string, DraftRoomRow>();
  readonly events: DraftRoomEventRow[] = [];
  readonly roomSnapshots: DraftRoomSnapshotRow[] = [];
  readonly sales = new Map<string, DraftRoomSaleRow>();
  readonly exports = new Map<string, DraftRoomExportRow>();
  readonly exportContents = new Map<string, DraftRoomExportContentRow>();
  readonly advisoryLockKeys: string[] = [];
  transactionsCommitted = 0;
  transactionsRolledBack = 0;
  failNextDraftRoomRevisionUpdate = false;
  rollbackGate?: Promise<void>;
  onRollbackStarted?: (() => void);
  private transactionDepth = 0;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) return await operation(this);
    this.transactionDepth += 1;
    const rowBackup = this.row === undefined
      ? undefined
      : {
        revision: this.row.revision,
        snapshot_json: cloneJson(this.row.snapshot_json),
      };
    const roomsBackup = new Map([...this.rooms].map(([id, row]) => [id, cloneRoomRow(row)]));
    const eventsBackup = this.events.map(cloneEventRow);
    const roomSnapshotsBackup = this.roomSnapshots.map(cloneDraftRoomSnapshotRow);
    const salesBackup = new Map([...this.sales].map(([id, row]) => [id, cloneSaleRow(row)]));
    const exportsBackup = new Map([...this.exports].map(([id, row]) => [id, cloneExportRow(row)]));
    const exportContentsBackup = new Map([...this.exportContents].map(([id, row]) => [id, cloneContentRow(row)]));

    try {
      const result = await operation(this);
      this.transactionsCommitted += 1;
      return result;
    } catch (error) {
      this.transactionsRolledBack += 1;
      this.onRollbackStarted?.();
      await this.rollbackGate;
      this.row = rowBackup;
      this.rooms.clear();
      for (const [id, row] of roomsBackup) this.rooms.set(id, row);
      this.events.splice(0, this.events.length, ...eventsBackup);
      this.roomSnapshots.splice(0, this.roomSnapshots.length, ...roomSnapshotsBackup);
      this.sales.clear();
      for (const [id, row] of salesBackup) this.sales.set(id, row);
      this.exports.clear();
      for (const [id, row] of exportsBackup) this.exports.set(id, row);
      this.exportContents.clear();
      for (const [id, row] of exportContentsBackup) this.exportContents.set(id, row);
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  override async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
      this.advisoryLockKeys.push(String(values[0]));
      return { rows: [] };
    }

    if (normalizedSql.startsWith("SELECT snapshot_json FROM draft_room_snapshots")) {
      const [roomId] = values as readonly [string];
      const snapshot = this.roomSnapshots
        .filter(row => row.draft_room_id === roomId)
        .sort((left, right) => normalizedSql.includes("ORDER BY revision ASC")
          ? left.revision - right.revision
          : right.revision - left.revision)[0];

      return {
        rows: snapshot === undefined
          ? []
          : [{ snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json } as TRow],
      };
    }

    if (normalizedSql.startsWith("SELECT snapshots.draft_room_id, snapshots.snapshot_json FROM draft_room_snapshots AS snapshots")) {
      const [seasonId] = values as readonly [string];
      const roomIds = new Set([...this.rooms.values()]
        .filter(room => room.league_season_id === seasonId && room.room_type === "real")
        .map(room => room.id));
      const snapshot = this.roomSnapshots
        .filter(row => roomIds.has(row.draft_room_id))
        .sort((left, right) => right.revision - left.revision)[0];

      return {
        rows: snapshot === undefined
          ? []
          : [{
            draft_room_id: snapshot.draft_room_id,
            snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json,
          } as TRow],
      };
    }

    if (normalizedSql.startsWith("SELECT id, draft_room_id, revision, event_type")) {
      const [roomId, throughRevision] = values as readonly [string, number];
      return {
        rows: this.events
          .filter(row => row.draft_room_id === roomId && row.revision <= throughRevision)
          .sort((left, right) => left.revision - right.revision)
          .map(row => cloneEventRow(row) as TRow),
      };
    }

    if (
      normalizedSql.startsWith("SELECT DISTINCT ON (draft_room_id) snapshot_json FROM draft_room_snapshots")
      || normalizedSql.startsWith("SELECT DISTINCT ON (draft_room_id) draft_room_id, snapshot_json FROM draft_room_snapshots")
    ) {
      const rows = [...new Set(this.roomSnapshots.map(snapshot => snapshot.draft_room_id))]
        .flatMap(roomId => {
          const snapshot = this.roomSnapshots
            .filter(row => row.draft_room_id === roomId)
            .sort((left, right) => right.revision - left.revision)[0];

          return snapshot === undefined ? [] : [{
            draft_room_id: snapshot.draft_room_id,
            snapshot_json: cloneDraftRoomSnapshotRow(snapshot).snapshot_json,
          } as TRow];
        });

      return { rows };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_rooms")) {
      const [
        id,
        leagueId,
        seasonId,
        status,
        createdByUserId,
        startsAt,
        startedAt,
        endedAt,
        currentRevision,
        createdAt,
        updatedAt,
      ] = values as readonly [
        string,
        string,
        string,
        string,
        string,
        Date | null,
        Date | null,
        Date | null,
        number,
        Date,
        Date,
      ];
      if (this.rooms.has(id)) return { rows: [], rowCount: 0 };

      this.rooms.set(id, {
        id,
        league_id: leagueId,
        league_season_id: seasonId,
        room_type: "real",
        status,
        created_by_user_id: createdByUserId,
        current_revision: currentRevision,
        starts_at: cloneDate(startsAt),
        started_at: cloneDate(startedAt),
        ended_at: cloneDate(endedAt),
        created_at: new Date(createdAt.getTime()),
        updated_at: new Date(updatedAt.getTime()),
      });

      return { rows: [{ id } as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE draft_rooms SET status = $2")) {
      if (this.failNextDraftRoomRevisionUpdate) {
        this.failNextDraftRoomRevisionUpdate = false;
        throw new Error("Injected draft room synchronization failure.");
      }
      const [
        roomId,
        status,
        currentRevision,
        startedAt,
        endedAt,
        updatedAt,
        expectedCurrentRevision,
      ] = values as readonly [string, string, number, Date | null, Date | null, Date, number];
      const room = this.rooms.get(roomId);
      if (room === undefined || room.current_revision !== expectedCurrentRevision) {
        return { rows: [], rowCount: 0 };
      }

      this.rooms.set(roomId, {
        ...room,
        status,
        current_revision: currentRevision,
        started_at: cloneDate(startedAt),
        ended_at: cloneDate(endedAt),
        updated_at: new Date(updatedAt.getTime()),
      });

      return { rows: [{ current_revision: currentRevision } as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_events")) {
      const [
        id,
        roomId,
        revision,
        sequence,
        eventType,
        actorUserId,
        idempotencyKey,
        mutationHash,
        expectedRevision,
        rawCommand,
        payloadJson,
        occurredAt,
      ] = values as readonly [
        string,
        string,
        number,
        number,
        string,
        string,
        string | null,
        string | null,
        number | null,
        string | null,
        unknown,
        Date,
      ];

      this.events.push({
        id,
        draft_room_id: roomId,
        revision,
        sequence,
        event_type: eventType,
        actor_user_id: actorUserId,
        idempotency_key: idempotencyKey,
        mutation_hash: mutationHash,
        expected_revision: expectedRevision,
        raw_command: rawCommand,
        payload_json: jsonValue(payloadJson),
        occurred_at: new Date(occurredAt.getTime()),
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_snapshots")) {
      const [id, roomId, revision, snapshotJson, snapshotHash, createdAt] =
        values as readonly [string, string, number, unknown, string, Date];

      this.roomSnapshots.push({
        id,
        draft_room_id: roomId,
        revision,
        snapshot_json: jsonValue(snapshotJson),
        snapshot_hash: snapshotHash,
        created_at: new Date(createdAt.getTime()),
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("DELETE FROM draft_room_snapshots")) {
      const [roomId, minimumRecentRevision] = values as readonly [string, number];
      const baseRevision = this.roomSnapshots
        .filter(snapshot => snapshot.draft_room_id === roomId)
        .reduce((minimum, snapshot) => Math.min(minimum, snapshot.revision), Number.POSITIVE_INFINITY);
      this.roomSnapshots.splice(
        0,
        this.roomSnapshots.length,
        ...this.roomSnapshots.filter(snapshot =>
          snapshot.draft_room_id !== roomId
          || snapshot.revision === baseRevision
          || snapshot.revision >= minimumRecentRevision
        ),
      );

      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_sales")) {
      const [
        id,
        roomId,
        sourceEventId,
        fantasyTeamId,
        playerName,
        normalizedPlayerName,
        position,
        price,
        expectedPrice,
        createdAt,
      ] = values as readonly [string, string, string, string, string, string, string, number, number, Date];

      this.sales.set(id, {
        id,
        draft_room_id: roomId,
        source_event_id: sourceEventId,
        fantasy_team_id: fantasyTeamId,
        player_name: playerName,
        normalized_player_name: normalizedPlayerName,
        position,
        price,
        expected_price: expectedPrice,
        status: "active",
        voided_by_event_id: null,
        created_at: new Date(createdAt.getTime()),
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE draft_room_sales SET status = 'voided'")) {
      const [sourceEventId, voidedByEventId] = values as readonly [string, string];
      const sale = [...this.sales.values()].find(candidate => candidate.source_event_id === sourceEventId);
      if (sale === undefined) return { rows: [], rowCount: 0 };

      this.sales.set(sale.id, {
        ...sale,
        status: "voided",
        voided_by_event_id: voidedByEventId,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT e.*, c.content_base64 FROM draft_room_exports e")) {
      if (normalizedSql.includes("WHERE e.id = $1")) {
        const [id] = values as readonly [string];
        const row = this.exportRowWithContent(id);

        return { rows: row === undefined ? [] : [row as TRow] };
      }

      if (normalizedSql.includes("WHERE e.draft_room_id = $1")) {
        const [roomId, sourceRevision, format] = values as readonly [string, number, string];
        const exportRow = [...this.exports.values()].find(candidate =>
          candidate.draft_room_id === roomId &&
          candidate.source_revision === sourceRevision &&
          candidate.artifact_type === format &&
          candidate.status === "completed"
        );
        const row = exportRow === undefined ? undefined : this.exportRowWithContent(exportRow.id);

        return { rows: row === undefined ? [] : [row as TRow] };
      }
    }

    if (normalizedSql.startsWith("SELECT * FROM draft_room_exports WHERE draft_room_id = $1")) {
      const [roomId] = values as readonly [string];
      const rows = [...this.exports.values()]
        .filter(row => row.draft_room_id === roomId && row.status === "completed")
        .sort((left, right) => {
          const createdAtOrder = right.created_at.getTime() - left.created_at.getTime();
          if (createdAtOrder !== 0) return createdAtOrder;

          const revisionOrder = right.source_revision - left.source_revision;
          return revisionOrder === 0 ? left.id.localeCompare(right.id) : revisionOrder;
        })
        .map(row => cloneExportRow(row) as TRow);

      return { rows };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_exports")) {
      const [
        id,
        leagueId,
        seasonId,
        roomId,
        createdByUserId,
        artifactType,
        storageKey,
        payloadHash,
        contentType,
        byteLength,
        sourceRevision,
        metadataJson,
        completedAt,
      ] = values as readonly [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        number,
        unknown,
        Date,
      ];
      if (this.exports.has(id)) return { rows: [], rowCount: 0 };

      this.exports.set(id, {
        id,
        league_id: leagueId,
        league_season_id: seasonId,
        draft_room_id: roomId,
        created_by_user_id: createdByUserId,
        artifact_type: artifactType,
        status: "completed",
        storage_key: storageKey,
        payload_hash: payloadHash,
        content_type: contentType,
        byte_length: byteLength,
        source_revision: sourceRevision,
        metadata_json: jsonValue(metadataJson),
        created_at: new Date(completedAt.getTime()),
        completed_at: new Date(completedAt.getTime()),
      });

      return { rows: [{ id } as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO draft_room_export_contents")) {
      const [id, artifactId, contentBase64, createdAt] =
        values as readonly [string, string, string, Date];
      if (this.exportContents.has(id)) return { rows: [], rowCount: 0 };

      this.exportContents.set(id, {
        id,
        artifact_id: artifactId,
        content_base64: contentBase64,
        created_at: new Date(createdAt.getTime()),
      });

      return { rows: [], rowCount: 1 };
    }

    return await super.query(text, values);
  }

  private exportRowWithContent(id: string): Record<string, unknown> | undefined {
    const exportRow = this.exports.get(id);
    const content = [...this.exportContents.values()].find(candidate => candidate.artifact_id === id);
    if (exportRow === undefined || content === undefined) return undefined;

    return {
      ...cloneExportRow(exportRow),
      content_base64: content.content_base64,
    };
  }
}

class AsyncJobRepository implements JobRepository {
  readonly inner = new InMemoryJobQueue();

  async submit(input: SubmitJobInput): Promise<JobRecord> {
    return this.inner.submit(input);
  }

  async claimNextJob(input: ClaimNextJobInput): Promise<JobRecord | null> {
    return this.inner.claimNextJob(input);
  }

  async updateProgress(input: UpdateJobProgressInput): Promise<JobRecord> {
    return this.inner.updateProgress(input);
  }

  async heartbeatJob(input: HeartbeatJobInput): Promise<JobRecord> {
    return this.inner.heartbeatJob(input);
  }

  async completeJob(input: CompleteJobInput): Promise<JobRecord> {
    return this.inner.completeJob(input);
  }

  async failJob(input: FailJobInput): Promise<JobRecord> {
    return this.inner.failJob(input);
  }

  async cancelJob(input: CancelJobInput): Promise<JobRecord> {
    return this.inner.cancelJob(input);
  }

  async cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): Promise<JobRecord> {
    return this.inner.cancelJobAtRunBoundary(input);
  }

  async rerunJob(input: RerunJobInput): Promise<JobRecord> {
    return this.inner.rerunJob(input);
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return this.inner.listForUser(userId);
  }

  async fetchForUser(jobId: string, userId: string): Promise<JobRecord | null> {
    return this.inner.fetchForUser(jobId, userId);
  }
}

class AsyncSimulationRepository implements SimulationRepository {
  readonly inner = new InMemorySimulationRepository();

  async createRequest(input: CreateSimulationRequestInput): Promise<SimulationRun> {
    return this.inner.createRequest(input);
  }

  async listForUser(userId: string): Promise<SimulationRun[]> {
    return this.inner.listForUser(userId);
  }

  async listHistoryForUserSeason(userId: string, seasonId: string, limit: number): Promise<SimulationRun[]> {
    return this.inner.listHistoryForUserSeason(userId, seasonId, limit);
  }

  async fetchForUser(runId: string, userId: string): Promise<SimulationRun | null> {
    return this.inner.fetchForUser(runId, userId);
  }

  async find(runId: string): Promise<SimulationRun> {
    return this.inner.find(runId);
  }

  async markRunning(runId: string, runAt: Date): Promise<SimulationRun> {
    return this.inner.markRunning(runId, runAt);
  }

  async markFailed(runId: string): Promise<SimulationRun> {
    return this.inner.markFailed(runId);
  }

  async markCanceled(runId: string): Promise<SimulationRun> {
    return this.inner.markCanceled(runId);
  }

  async resetForRerun(runId: string): Promise<SimulationRun> {
    return this.inner.resetForRerun(runId);
  }

  async complete(runId: string, result: SimulationResult): Promise<SimulationRun> {
    return this.inner.complete(runId, result);
  }
}

class AsyncLeagueSetupRepository implements LeagueSetupRepository {
  readonly inner = new InMemoryPlatformStore();
  readonly registerInputs: RegisterLeagueSeasonRepositoryInput[] = [];

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput) {
    this.registerInputs.push(structuredClone(input));

    return this.inner.registerLeagueSeason(input);
  }

  async archiveLeague(input: Parameters<LeagueSetupRepository["archiveLeague"]>[0]) {
    return this.inner.archiveLeague(input);
  }

  async isLeagueArchived(leagueId: string) {
    return this.inner.isLeagueArchived(leagueId);
  }

  async claimLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["claimLeagueSeasonTeam"]>[0]) {
    return this.inner.claimLeagueSeasonTeam(input);
  }

  async joinLeagueSeasonTeam(input: Parameters<LeagueSetupRepository["joinLeagueSeasonTeam"]>[0]) {
    return this.inner.joinLeagueSeasonTeam(input);
  }

  async findLeagueSeason(seasonId: string) {
    return this.inner.findLeagueSeason(seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string) {
    return this.inner.hasLeagueSeasonForLeague(leagueId);
  }

  async findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
  }

  async findMembership(userId: string, leagueId: string) {
    return this.inner.findMembership(userId, leagueId);
  }

  async membershipsForLeague(leagueId: string) {
    return this.inner.membershipsForLeague(leagueId);
  }
}

class AsyncHistoricalImportRepository implements HistoricalImportRepository {
  readonly inner: InMemoryHistoricalImportRepository;
  transactionCount = 0;

  constructor(leagueSeasons = [buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 214674",
    setupStatus: "published",
  })], readonly createBatchGate?: InsertGate) {
    this.inner = new InMemoryHistoricalImportRepository(leagueSeasons);
  }

  async withTransaction<T>(operation: (repository: HistoricalImportRepository) => T | Promise<T>): Promise<T> {
    this.transactionCount += 1;

    return await operation(this);
  }

  async findLeagueSeason(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeason(leagueId, seasonYear);
  }

  async findBatchById(batchId: string) {
    return this.inner.findBatchById(batchId);
  }

  async findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.findBatchByFileHash(leagueId, seasonYear, fileHash);
  }

  async findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.findCommittedBatchByFileHash(leagueId, seasonYear, fileHash);
  }

  async findCurrentCommittedBatch(leagueId: string, seasonYear: number) {
    return this.inner.findCurrentCommittedBatch(leagueId, seasonYear);
  }

  async nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.nextBatchOrdinal(leagueId, seasonYear, fileHash);
  }

  async prunePreviewBatches(input: Parameters<HistoricalImportRepository["prunePreviewBatches"]>[0]) {
    this.inner.prunePreviewBatches(input);
  }

  async createBatch(batch: Parameters<HistoricalImportRepository["createBatch"]>[0]) {
    this.createBatchGate?.entered();
    await this.createBatchGate?.release;
    return this.inner.createBatch(batch);
  }

  async updateBatch(batch: Parameters<HistoricalImportRepository["updateBatch"]>[0]) {
    return this.inner.updateBatch(batch);
  }

  async addRecords(records: Parameters<HistoricalImportRepository["addRecords"]>[0]) {
    this.inner.addRecords(records);
  }

  async currentRecords(leagueId: string, seasonYear: number) {
    return this.inner.currentRecords(leagueId, seasonYear);
  }

  async currentRecordsThroughSeason(leagueId: string, seasonYear: number) {
    return this.inner.currentRecordsThroughSeason(leagueId, seasonYear);
  }
}

const deferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve!: () => void;
  const promise = new Promise<void>(innerResolve => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

const listen = async (platformServer: PlatformServer): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    platformServer.server.once("error", reject);
    platformServer.server.listen(0, "127.0.0.1", resolve);
  });

  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected TCP test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

const jsonFetch = async (
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<JsonFetchResult> => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const setCookie = response.headers.get("set-cookie");
  const retryAfter = response.headers.get("retry-after");

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    ...(setCookie === null ? {} : { setCookie }),
    ...(retryAfter === null ? {} : { retryAfter }),
    body: await response.json(),
  };
};

const requestBeforeSendingBody = async (
  baseUrl: string,
  path: string,
  sessionToken?: string,
): Promise<{
  request: ClientRequest;
  response: JsonFetchResult;
}> => {
  let clientRequest!: ClientRequest;
  const response = new Promise<JsonFetchResult>((resolve, reject) => {
    clientRequest = httpRequest(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-length": "1000",
        "content-type": "application/json",
        ...(sessionToken === undefined ? {} : { "x-session-token": sessionToken }),
      },
    }, incomingResponse => {
      const chunks: Buffer[] = [];
      incomingResponse.on("data", chunk => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      incomingResponse.on("end", () => {
        const setCookie = incomingResponse.headers["set-cookie"]?.[0];
        resolve({
          status: incomingResponse.statusCode ?? 0,
          contentType: incomingResponse.headers["content-type"] ?? null,
          ...(setCookie === undefined ? {} : { setCookie }),
          ...(incomingResponse.headers["retry-after"] === undefined
            ? {}
            : { retryAfter: incomingResponse.headers["retry-after"] }),
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
        });
      });
    });
    clientRequest.once("error", reject);
    clientRequest.flushHeaders();
  });

  const guardedResponse = await new Promise<JsonFetchResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      clientRequest.destroy();
      reject(new Error("Server waited for the request body."));
    }, 250);
    response.then(result => {
      clearTimeout(timeout);
      resolve(result);
    }, error => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  return { request: clientRequest, response: guardedResponse };
};

const textFetch = async (
  baseUrl: string,
  path: string,
): Promise<{ status: number; contentType: string | null; body: string }> => {
  const response = await fetch(`${baseUrl}${path}`);

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    body: await response.text(),
  };
};

describe("platform server composition", () => {
  it("publishes live-room revisions produced by reopen mutations", () => {
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/live-rooms/room_2026/reopen",
      body: {},
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 7 } },
    })).toEqual({ roomId: "room_2026", revision: 7 });
  });

  it("publishes live-room revisions produced by keeper mutations", () => {
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/seasons/season_2026/keepers/apply",
      body: {},
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 3 } },
    })).toEqual({ roomId: "room_2026", revision: 3 });
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/historical-imports/batch_2025/commit",
      body: { seasonId: "season_2026" },
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 4 } },
    })).toEqual({ roomId: "room_2026", revision: 4 });
  });

  let directory: string | undefined;
  const servers: PlatformServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => server.close()));
    servers.length = 0;

    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
      directory = undefined;
    }
  });

  const storePath = async (): Promise<string> => {
    directory = await mkdtemp(join(tmpdir(), "mockd-platform-server-"));

    return join(directory, "platform-store.json");
  };

  const createListeningServer = async (
    options: Partial<Parameters<typeof createPlatformServer>[0]> = {},
  ): Promise<{ platformServer: PlatformServer; baseUrl: string }> => {
    const platformServer = await createPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
      ...options,
    });
    servers.push(platformServer);

    return {
      platformServer,
      baseUrl: await listen(platformServer),
    };
  };

  it("reports dependency readiness through the real HTTP server", async () => {
    let ready = false;
    const { platformServer, baseUrl } = await createListeningServer({
      readinessProbe: async () => ready,
    });

    await expect(jsonFetch(baseUrl, "/healthz")).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
    await expect(jsonFetch(baseUrl, "/readyz")).resolves.toMatchObject({
      status: 503,
      body: { status: "unavailable" },
    });

    ready = true;
    await expect(jsonFetch(baseUrl, "/readyz")).resolves.toMatchObject({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("creates accounts and logs in through the real HTTP server", async () => {
    const { baseUrl } = await createListeningServer();

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  Cam@Example.com ",
        password: "secure password",
      }),
    });

    expect(created).toMatchObject({
      status: 201,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "cam@example.com",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      },
    });

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login).toMatchObject({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: {
        account: {
          id: expect.stringMatching(/^acct_/),
          email: "cam@example.com",
        },
        session: {
          id: expect.stringMatching(/^sess_/),
          accountId: expect.any(String),
          createdAt: now.toISOString(),
        },
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
    expect(login.body).not.toHaveProperty("sessionToken");
    expect(JSON.stringify(login.body)).not.toContain("tokenHash");
  });

  it("verifies and recovers a production-style account through the real HTTP server", async () => {
    const authMailSender = new CapturingAuthMailSender();
    const { baseUrl } = await createListeningServer({
      emailVerificationRequired: true,
      authMailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    const signup = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "secure password" }),
    });
    expect(signup).toMatchObject({ status: 202, body: { accepted: true } });
    const verificationMessage = authMailSender.messages[0];
    const verificationToken = new URL(
      verificationMessage?.actionUrl ?? "https://invalid.local",
    ).searchParams.get("token") ?? "";

    await expect(jsonFetch(baseUrl, "/email-verifications/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: verificationToken }),
    })).resolves.toMatchObject({ status: 200, body: { verified: true } });
    await expect(jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "secure password" }),
    })).resolves.toMatchObject({ status: 200 });

    await jsonFetch(baseUrl, "/password-resets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com" }),
    });
    const resetMessage = authMailSender.messages[1];
    const resetToken = new URL(resetMessage?.actionUrl ?? "https://invalid.local").searchParams.get("token") ?? "";
    await expect(jsonFetch(baseUrl, "/password-resets/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        newPassword: "replacement password",
        newPasswordConfirmation: "replacement password",
      }),
    })).resolves.toMatchObject({ status: 200, body: { reset: true } });
  });

  it("creates, publishes, and provisions a new league from the current catalog", async () => {
    const currentPlayerCatalog = await loadCurrentPlayerCatalog();
    const { baseUrl } = await createListeningServer({
      currentPlayerCatalogProvider: async () => currentPlayerCatalog,
    });
    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-commissioner@example.com", password: "secure password" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new-commissioner@example.com", password: "secure password" }),
    });
    const sessionToken = sessionTokenFrom(login);
    const headers = {
      "content-type": "application/json",
      "x-session-token": sessionToken,
    };
    const created = await jsonFetch(baseUrl, "/leagues", {
      method: "POST",
      headers,
      body: JSON.stringify({
        setup: {
          provider: "espn",
          externalLeagueId: "new-22",
          leagueName: "New League",
          seasonYear: 2026,
          expectedTeamCount: 4,
          teams: [
            { externalTeamId: "1", displayName: "One", managerNames: ["Cam"] },
            { externalTeamId: "2", displayName: "Two", managerNames: ["Beaton"] },
            { externalTeamId: "3", displayName: "Three", managerNames: ["Seth"] },
            { externalTeamId: "4", displayName: "Four", managerNames: ["Nick"] },
          ],
          draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
          scoring: { ...defaultScoringSettings },
          rosterSlots: { QB: 1, RB: 1 },
        },
      }),
    });
    const seasonId = (created.body as { season: { id: string } }).season.id;

    expect(created.status).toBe(201);
    expect((await jsonFetch(baseUrl, `/seasons/${seasonId}/publish`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmed: true }),
    })).status).toBe(200);
    const liveRoom = await jsonFetch(baseUrl, `/seasons/${seasonId}/live-room`, {
      method: "POST",
      headers,
      body: "{}",
    });

    expect(liveRoom).toMatchObject({
      status: 201,
      body: {
        room: {
          seasonId,
          board: expect.any(Array),
        },
      },
    });
    expect((liveRoom.body as { room: { board: unknown[] } })
      .room.board).toHaveLength(currentPlayerCatalog.length);
  });

  it("passes the trusted proxy client address to auth rate limiting", async () => {
    const seenClientAddresses: string[] = [];
    const { baseUrl } = await createListeningServer({
      trustProxy: true,
      authClientRateLimiter: {
        consume: clientAddress => {
          seenClientAddresses.push(clientAddress);

          return { allowed: true, remainingAttempts: 29, retryAfterMs: 0 };
        },
        reset: () => undefined,
      },
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.45, 10.0.0.9",
      },
      body: JSON.stringify({
        email: "proxy-user@example.com",
        password: "secure password",
      }),
    });

    expect(created.status).toBe(201);
    expect(seenClientAddresses).toEqual(["203.0.113.45"]);
  });

  it("serves the platform app shell from auth browser routes", async () => {
    const { baseUrl } = await createListeningServer();

    const response = await textFetch(baseUrl, "/login");

    expect(response.status).toBe(200);
    expect(response.contentType).toBe("text/html; charset=utf-8");
    expect(response.body).toContain("id=\"auth-panel\"");
    expect(response.body).toContain("League home");
    expect(response.body).toContain("Open live draft");

    for (const path of ["/verify-email", "/forgot-password", "/reset-password"]) {
      const recovery = await textFetch(baseUrl, path);
      expect(recovery.status).toBe(200);
      expect(recovery.body).toContain("id=\"auth-panel\"");
    }
  });

  it("renders screenshot controls only when the shell capability is enabled", async () => {
    const manual = await createListeningServer({
      shellCapabilities: { leagueCreationScreenshotAnalysis: false },
    });
    const openAi = await createListeningServer({
      shellCapabilities: { leagueCreationScreenshotAnalysis: true },
    });

    const manualResponse = await textFetch(manual.baseUrl, "/league?create=1");
    const openAiResponse = await textFetch(openAi.baseUrl, "/league?create=1");

    expect(manualResponse.status).toBe(200);
    expect(manualResponse.body).toContain('data-league-step="teams"');
    expect(manualResponse.body).not.toContain('id="league-create-screenshot-panel"');
    expect(openAiResponse.status).toBe(200);
    expect(openAiResponse.body).toContain('id="league-create-screenshot-panel"');
  });

  it("serves the dedicated draft room from the production draft route", async () => {
    const { baseUrl } = await createListeningServer();

    const signup = await textFetch(baseUrl, "/signup");
    const draftRoom = await textFetch(baseUrl, "/draft-room");

    expect(signup.status).toBe(200);
    expect(signup.contentType).toBe("text/html; charset=utf-8");
    expect(signup.body).toContain("id=\"auth-panel\"");
    expect(signup.body).not.toContain("id=\"draft-room-view\"");

    expect(draftRoom.status).toBe(200);
    expect(draftRoom.contentType).toBe("text/html; charset=utf-8");
    expect(draftRoom.body).toContain("id=\"draft-room-view\"");
    expect(draftRoom.body).toContain("data-platform-live-room");
    expect(draftRoom.body).not.toContain("id=\"draft-room-link\"");
  });

  it("serves Practice before league selection and keeps private prep scoped to members", async () => {
    directory = await mkdtemp(join(tmpdir(), "mockd-platform-draft-tools-"));
    const draftSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      draftToolsSessionDirectory: directory,
      liveDraftRoomSetupRepository: draftSetupRepository,
    });
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });

    const anonymousBoard = await fetch(
      `${baseUrl}/practice?seasonId=${season.id}&strategy=balanced`,
      {
        redirect: "manual",
      },
    );
    expect(anonymousBoard.status).toBe(200);
    expect(await anonymousBoard.text()).toContain("id=\"auth-panel\"");

    const prepAccount = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "prep@example.com", password: "secure password" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "prep@example.com", password: "secure password" }),
    });
    const sessionToken = sessionTokenFrom(login);
    const accountId = (prepAccount.body as { account: { id: string } }).account.id;
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: sessionToken,
      season,
      memberships: [{
        userId: accountId,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
      now,
    });
    await draftSetupRepository.save({
      seasonId: season.id,
      sourceVersion: "platform-server-test",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      updatedAt: now,
    });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outsider@example.com", password: "secure password" }),
    });
    const outsiderLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "outsider@example.com", password: "secure password" }),
    });
    const outsiderSessionToken = sessionTokenFrom(outsiderLogin);

    const missingSeason = await fetch(`${baseUrl}/practice`, {
      headers: { "x-session-token": sessionToken },
    });
    expect(missingSeason.status).toBe(200);
    expect(await missingSeason.text()).toContain("id=\"standalone-board\"");

    const outsiderBoard = await fetch(`${baseUrl}/practice?seasonId=${season.id}`, {
      headers: { "x-session-token": outsiderSessionToken },
    });
    expect(outsiderBoard.status).toBe(200);
    expect(await outsiderBoard.text()).toContain("id=\"standalone-board\"");

    const board = await fetch(`${baseUrl}/practice?seasonId=${season.id}`, {
      headers: { "x-session-token": sessionToken },
    });
    expect(board.status).toBe(200);
    expect(board.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await board.text()).toContain("id=\"standalone-board\"");

    const mockState = await jsonFetch(
      baseUrl,
      `/api/mock/state?seasonId=${season.id}&mode=interactive-mock&draftSession=practice-3rb`,
      {
        headers: { "x-session-token": sessionToken },
      },
    );
    expect(mockState).toMatchObject({
      status: 200,
      body: { draftMode: "interactive-mock" },
    });
  });

  it("bounds event streams and releases capacity after completion or disconnect", async () => {
    const { baseUrl } = await createListeningServer({
      liveDraftRoomEventStreamMaxConnectionsPerAccount: 1,
      liveDraftRoomEventStreamMaxConnections: 1,
      liveDraftRoomEventStreamRetryAfterSeconds: 3,
    });
    const camCreated = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });
    const sethCreated = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "seth@example.com", password: "secure password" }),
    });
    const camLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });
    const sethLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "seth@example.com", password: "secure password" }),
    });
    const camAccount = (camCreated.body as { account: { id: string } }).account;
    const sethAccount = (sethCreated.body as { account: { id: string } }).account;
    const camSessionToken = sessionTokenFrom(camLogin);
    const sethSessionToken = sessionTokenFrom(sethLogin);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");

    await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": camSessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          { userId: camAccount.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: sethAccount.id, leagueId: season.leagueId, role: "member", ownerId: sethTeam.ownerId, teamId: sethTeam.id },
        ],
      }),
    });
    await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": camSessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_stream_wait",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
      }),
    });
    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_stream_wait",
      }),
    });

    const streamTextPromise = fetch(`${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=2`, {
      headers: { "x-session-token": sethSessionToken },
    }).then(async response => {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");

      return await response.text();
    });
    await new Promise(resolve => setTimeout(resolve, 20));

    const limitedStream = await fetch(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=2`,
      {
        headers: { "x-session-token": sethSessionToken },
        signal: AbortSignal.timeout(1_000),
      },
    );
    expect(limitedStream.status).toBe(429);
    expect(limitedStream.headers.get("retry-after")).toBe("3");
    await expect(limitedStream.json()).resolves.toEqual({
      error: {
        code: "live_draft_event_stream_limit",
        message: "Too many live draft connections. Try again shortly.",
      },
    });

    const globallyLimitedStream = await fetch(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=2`,
      {
        headers: { "x-session-token": camSessionToken },
        signal: AbortSignal.timeout(1_000),
      },
    );
    expect(globallyLimitedStream.status).toBe(429);
    expect(globallyLimitedStream.headers.get("retry-after")).toBe("3");

    const sale = await Promise.race([
      jsonFetch(baseUrl, "/live-rooms/room_stream_wait/sales", {
        method: "POST",
        headers: { "content-type": "application/json", "x-session-token": camSessionToken },
        body: JSON.stringify({
          expectedRevision: 2,
          idempotencyKey: "sale:puka:62",
          command: "cam puka 62",
        }),
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out posting sale.")), 1_000)),
    ]);
    const streamText = await Promise.race([
      streamTextPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for event stream.")), 1_000)),
    ]);

    expect(sale.status).toBe(200);
    expect(streamText).toContain("event: room.sale\n");
    expect(streamText).toContain("\"playerName\":\"Puka Nacua\"");

    const recoveredStreamPromise = fetch(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=3`,
      { headers: { "x-session-token": sethSessionToken } },
    ).then(async response => {
      expect(response.status).toBe(200);

      return await response.text();
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/pause", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({
        expectedRevision: 3,
        idempotencyKey: "pause:room_stream_wait",
      }),
    });

    await expect(Promise.race([
      recoveredStreamPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting for recovered event stream.")), 1_000)),
    ])).resolves.toContain("event: room.paused\n");

    const disconnectedStream = httpRequest(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=4`,
      { headers: { "x-session-token": sethSessionToken } },
    );
    disconnectedStream.on("error", () => undefined);
    disconnectedStream.end();
    await new Promise(resolve => setTimeout(resolve, 20));

    const disconnectProbe = await fetch(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=4`,
      {
        headers: { "x-session-token": sethSessionToken },
        signal: AbortSignal.timeout(1_000),
      },
    );
    expect(disconnectProbe.status).toBe(429);

    disconnectedStream.destroy();
    await new Promise(resolve => setTimeout(resolve, 20));
    const afterDisconnectStreamPromise = fetch(
      `${baseUrl}/live-rooms/room_stream_wait/event-stream?afterRevision=4`,
      { headers: { "x-session-token": sethSessionToken } },
    ).then(async response => {
      expect(response.status).toBe(200);

      return await response.text();
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    await jsonFetch(baseUrl, "/live-rooms/room_stream_wait/resume", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-token": camSessionToken },
      body: JSON.stringify({
        expectedRevision: 4,
        idempotencyKey: "resume:room_stream_wait",
      }),
    });

    await expect(Promise.race([
      afterDisconnectStreamPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out waiting after disconnect cleanup.")), 1_000)),
    ])).resolves.toContain("event: room.resumed\n");
  });

  it("keeps createPlatformServer unbound and starts listening only through the start helper", async () => {
    const platformServer = await createPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(platformServer);

    expect(platformServer.server.listening).toBe(false);

    const startedServer = await startPlatformServer({
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
      port: 0,
      host: "127.0.0.1",
    });
    servers.push(startedServer);

    expect(startedServer.server.listening).toBe(true);
    expect(startedServer.url).toBe(`http://127.0.0.1:${startedServer.port}`);

    const created = await jsonFetch(startedServer.url, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "start-helper@example.com",
        password: "secure password",
      }),
    });

    expect(created.status).toBe(201);
  });

  it("returns adapter JSON errors for malformed request bodies", async () => {
    const { baseUrl } = await createListeningServer();

    const response = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\"email\":",
    });

    expect(response).toEqual({
      status: 400,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
    });
  });

  it("loads file-backed state on startup and persists successful mutations", async () => {
    const dataFilePath = await storePath();
    const { platformServer, baseUrl } = await createListeningServer({ dataFilePath });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    await platformServer.liveDraftRoomSetupRepository?.save({
      seasonId: "season_restart_2026",
      sourceVersion: "catalog-2026",
      playerCatalog: [{ name: "De'Von Achane", position: "RB", expectedPrice: 50 }],
      initialRosters: [{
        teamId: "team_cam",
        playerName: "De'Von Achane",
        position: "RB",
        price: 48,
        source: "keeper",
      }],
      updatedAt: now,
    });
    await platformServer.persist();

    const saved = await readFile(dataFilePath, "utf8");
    const savedAuth = await readFile(`${dataFilePath}.auth.json`, "utf8");
    expect(saved).not.toContain("cam@example.com");
    expect(savedAuth).toContain("cam@example.com");
    expect(JSON.parse(saved)).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [],
        sessions: [],
      },
      liveDraftRoomSetups: [{
        seasonId: "season_restart_2026",
        initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
      }],
    });
    expect(JSON.parse(savedAuth)).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [{
          account: {
            email: "cam@example.com",
            createdAt: now.toISOString(),
          },
        }],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "cam@example.com",
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
    await expect(
      loadedServer.liveDraftRoomSetupRepository?.findForSeason("season_restart_2026"),
    ).resolves.toMatchObject({
      initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
    });
  });

  it("persists file-backed auth requests without rewriting workspace state", async () => {
    const dataFilePath = await storePath();
    const { platformServer, baseUrl } = await createListeningServer({ dataFilePath });
    await platformServer.persist();
    const workspaceBefore = await readFile(dataFilePath, "utf8");

    await expect(jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fast-auth@example.com", password: "secure password" }),
    })).resolves.toMatchObject({ status: 201 });
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);
    expect(await readFile(`${dataFilePath}.auth.json`, "utf8")).toContain("fast-auth@example.com");

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "fast-auth@example.com", password: "secure password" }),
    });
    expect(login.status).toBe(200);
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);

    await expect(jsonFetch(baseUrl, "/session", {
      method: "DELETE",
      headers: { "x-session-token": sessionTokenFrom(login) },
    })).resolves.toMatchObject({ status: 200 });
    expect(await readFile(dataFilePath, "utf8")).toBe(workspaceBefore);
  });

  it("loads Postgres-backed state on startup and persists successful mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      initializePostgresSchema: true,
    });

    await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(postgresClient.row).toMatchObject({
      revision: 1,
      snapshot_json: {
        schemaVersion: 1,
        auth: {
          accountCredentials: [
            {
              account: {
                email: "cam@example.com",
                createdAt: now.toISOString(),
              },
            },
          ],
        },
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });

    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      account: {
        email: "cam@example.com",
      },
    });
    expect(login.setCookie).toContain("mockd_session=");
  });

  it("uses normalized Postgres live room and export artifact repositories across server restart", async () => {
    const postgresClient = new FakeTransactionalPlatformPostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          {
            userId: accountId,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    });

    const roomCreated = await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_postgres_normalized",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
        initialRosters: completeInitialRostersFor(season, camTeam.id),
      }),
    });
    const rollbacksBeforeConflict = postgresClient.transactionsRolledBack;
    const failedStart = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 99,
        idempotencyKey: "start:room_postgres_normalized:stale",
      }),
    });
    expect(failedStart.status).toBe(409);
    expect(postgresClient.transactionsRolledBack).toBe(rollbacksBeforeConflict + 1);
    expect(postgresClient.events).toHaveLength(1);
    expect(postgresClient.rooms.get("room_postgres_normalized")?.current_revision).toBe(1);
    const roomStarted = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_postgres_normalized",
      }),
    });
    const saleLogged = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/sales", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "sale:puka:62",
        sale: "cam puka 62",
      }),
    });
    const roomEnded = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 3,
        idempotencyKey: "end:room_postgres_normalized",
      }),
    });
    const exportArtifact = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:05:00.000Z",
      }),
    });
    const artifactId = (exportArtifact.body as { artifact: { id: string } }).artifact.id;
    const snapshot = postgresClient.row?.snapshot_json as {
      exportArtifactContents?: readonly unknown[];
      exportArtifacts?: readonly unknown[];
      liveDraftRooms?: readonly unknown[];
    } | undefined;

    expect(platformServer.postgresLiveDraftRoomRepository).toBeDefined();
    expect(platformServer.postgresExportArtifactRepository).toBeDefined();
    expect(roomCreated.status).toBe(201);
    expect(roomStarted).toMatchObject({
      status: 200,
      body: { room: { revision: 2, status: "live" } },
    });
    expect(postgresClient.advisoryLockKeys).toContain(`mockd:draft-mutation:${season.id}`);
    expect(saleLogged).toMatchObject({
      status: 200,
      body: {
        room: {
          revision: 3,
          salesLog: [
            expect.objectContaining({
              playerName: "Puka Nacua",
              price: 62,
            }),
          ],
        },
      },
    });
    expect(roomEnded).toMatchObject({
      status: 200,
      body: { room: { revision: 4, status: "ended" } },
    });
    expect(exportArtifact).toMatchObject({
      status: 201,
      body: {
        artifact: {
          id: artifactId,
          roomId: "room_postgres_normalized",
          sourceRevision: 4,
        },
        content: expect.stringContaining("Puka Nacua,62"),
      },
    });
    expect(postgresClient.events.map(event => [event.revision, event.event_type])).toEqual([
      [1, "room_created"],
      [2, "room_started"],
      [3, "sale_logged"],
      [4, "room_ended"],
    ]);
    expect([...postgresClient.sales.values()]).toMatchObject([
      {
        draft_room_id: "room_postgres_normalized",
        player_name: "Puka Nacua",
        status: "active",
      },
    ]);
    expect(postgresClient.exports.get(artifactId)).toMatchObject({
      created_by_user_id: accountId,
      draft_room_id: "room_postgres_normalized",
      source_revision: 4,
    });
    expect(postgresClient.exportContents).toHaveLength(1);
    expect(postgresClient.row?.revision).toBe(3);
    expect(snapshot).toMatchObject({
      liveDraftRooms: [],
      exportArtifacts: [],
      exportArtifactContents: [],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const reloadedRoom = await jsonFetch(loadedBaseUrl, "/live-rooms/room_postgres_normalized", {
      headers: { "x-session-token": sessionToken },
    });
    const retriedArtifact = await jsonFetch(loadedBaseUrl, "/live-rooms/room_postgres_normalized/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:06:00.000Z",
      }),
    });

    expect(loadedServer.postgresLiveDraftRoomRepository).toBeDefined();
    expect(loadedServer.postgresExportArtifactRepository).toBeDefined();
    expect(reloadedRoom).toMatchObject({
      status: 200,
      body: {
        room: {
          roomId: "room_postgres_normalized",
          status: "ended",
          revision: 4,
          salesLog: [
            expect.objectContaining({
              playerName: "Puka Nacua",
              price: 62,
            }),
          ],
        },
      },
    });
    expect(retriedArtifact).toEqual(exportArtifact);
    expect(postgresClient.exports).toHaveLength(1);
    expect(postgresClient.exportContents).toHaveLength(1);
  });

  it("restores process-local pricing when historical room synchronization rolls back", async () => {
    const postgresClient = new FakeTransactionalPlatformPostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "cam@example.com", password: "secure password" }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Rollback League",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [{
          userId: accountId,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      }),
    });
    const roomCreated = await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_history_rollback",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
      }),
    });
    expect(roomCreated.status).toBe(201);
    const preview = await platformServer.app.previewHistoricalImportSource({
      actorSessionToken: sessionToken,
      leagueId: season.leagueId,
      seasonYear: 2025,
      currentSeasonId: season.id,
      sourceText: [
        "owner,player,position,price,year,player id,keeper,acquisition",
        "Cam,Puka Nacua,WR,$61,2025,player-puka,false,auction",
      ].join("\n"),
      now,
    });
    await platformServer.persist();
    const batchId = preview.batch.id;
    postgresClient.failNextDraftRoomRevisionUpdate = true;
    let markRollbackStarted!: () => void;
    const rollbackStarted = new Promise<void>(resolve => {
      markRollbackStarted = resolve;
    });
    let releaseRollback!: () => void;
    postgresClient.rollbackGate = new Promise<void>(resolve => {
      releaseRollback = resolve;
    });
    postgresClient.onRollbackStarted = markRollbackStarted;

    const failedCommitRequest = jsonFetch(baseUrl, `/historical-imports/${batchId}/commit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({ seasonId: season.id, seasonYear: 2025 }),
    });
    await rollbackStarted;
    const pricingAfterRollbackRequest = jsonFetch(baseUrl, `/seasons/${season.id}/pricing-snapshots`, {
      headers: { "x-session-token": sessionToken },
    });
    const concurrentReadState = await Promise.race([
      pricingAfterRollbackRequest.then(() => "resolved"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), 50)),
    ]);
    releaseRollback();
    const [failedCommit, pricingAfterRollback] = await Promise.all([
      failedCommitRequest,
      pricingAfterRollbackRequest,
    ]);
    const roomAfterRollback = await jsonFetch(baseUrl, "/live-rooms/room_history_rollback", {
      headers: { "x-session-token": sessionToken },
    });

    expect(preview).toMatchObject({ batch: { status: "previewed" } });
    expect(concurrentReadState).toBe("blocked");
    expect(failedCommit.status).toBe(500);
    expect(pricingAfterRollback).toMatchObject({ status: 200, body: { pricingSnapshots: [] } });
    expect(roomAfterRollback).toMatchObject({
      status: 200,
      body: { room: { revision: 1, salesLog: [] } },
    });
    expect((postgresClient.row?.snapshot_json as { pricingSnapshots?: unknown[] }).pricingSnapshots).toEqual([]);
  });

  it("uses app authorization for normalized live rooms when league setup is external", async () => {
    const postgresClient = new FakePostgresClient();
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const liveDraftRoomClient = new FakeTransactionalPlatformPostgresClient();
    const { baseUrl } = await createListeningServer({
      postgresClient,
      leagueSetupRepository,
      postgresLiveDraftRoomClient: liveDraftRoomClient,
      postgresExportArtifactClient: liveDraftRoomClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        season,
        memberships: [
          {
            userId: accountId,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    });

    const roomCreated = await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_external_setup",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
        initialRosters: completeInitialRostersFor(season),
      }),
    });
    const roomStarted = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_external_setup",
      }),
    });
    const roomEnded = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "end:room_external_setup",
      }),
    });
    const exportArtifact = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:05:00.000Z",
      }),
    });
    const snapshot = postgresClient.row?.snapshot_json as {
      exportArtifactContents?: readonly unknown[];
      exportArtifacts?: readonly unknown[];
      leagueSeasons?: readonly unknown[];
      liveDraftRooms?: readonly unknown[];
      memberships?: readonly unknown[];
    } | undefined;

    expect(roomCreated.status).toBe(201);
    expect(roomStarted).toMatchObject({
      status: 200,
      body: { room: { revision: 2, status: "live" } },
    });
    expect(roomEnded).toMatchObject({
      status: 200,
      body: { room: { revision: 3, status: "ended" } },
    });
    expect(exportArtifact).toMatchObject({
      status: 201,
      body: {
        artifact: {
          roomId: "room_external_setup",
          sourceRevision: 3,
        },
      },
    });
    expect(snapshot).toMatchObject({
      leagueSeasons: [],
      memberships: [],
      liveDraftRooms: [],
      exportArtifacts: [],
      exportArtifactContents: [],
    });
  });

  it("uses Postgres auth for account and session HTTP routes without snapshot auth writes", async () => {
    const postgresClient = new FakePostgresClient();
    const postgresAuthClient = new FakePostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      postgresAuthClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);

    expect(platformServer.authRepository).toBe(platformServer.postgresAuthRepository);
    expect(postgresClient.row).toBeUndefined();
    expect(postgresAuthClient.accounts.get(accountId)).toMatchObject({
      email: "cam@example.com",
      email_normalized: "cam@example.com",
      password_hash: expect.stringMatching(/^scrypt\$/),
    });
    expect(JSON.stringify([...postgresAuthClient.sessions.values()])).not.toContain(sessionToken);

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    const registered = await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          {
            userId: accountId,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    });

    expect(registered.status).toBe(200);
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [],
        sessions: [],
      },
      memberships: [
        expect.objectContaining({
          userId: accountId,
          leagueId: season.leagueId,
        }),
      ],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      postgresAuthClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const loadedSeason = await jsonFetch(loadedBaseUrl, `/seasons/${season.id}`, {
      headers: { "x-session-token": sessionToken },
    });

    expect(loadedSeason).toMatchObject({
      status: 200,
      body: {
        season: {
          id: season.id,
          leagueId: season.leagueId,
        },
      },
    });
    expect(loadedServer.store.snapshot().auth).toEqual({
      accountCredentials: [],
      sessions: [],
    });
  });

  it("initializes normalized auth schema when auth is the only Postgres-backed repository", async () => {
    const postgresAuthClient = new FakeTransactionalPostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresAuthClient,
      initializePostgresSchema: true,
    });

    expect(platformServer.postgresAuthRepository).toBeDefined();
    expect(postgresAuthClient.statements.some(statement =>
      statement.includes("CREATE TABLE IF NOT EXISTS platform_schema_migrations")
    )).toBe(true);
    expect(postgresAuthClient.statements.some(statement =>
      normalizeSql(statement).startsWith("CREATE TABLE accounts")
    )).toBe(true);

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-only@example.com",
        password: "secure password",
      }),
    });

    expect(created).toMatchObject({
      status: 201,
      body: {
        account: {
          email: "auth-only@example.com",
        },
      },
    });
    expect(postgresAuthClient.accounts.size).toBe(1);
  });

  it("scrubs stale snapshot auth when Postgres auth owns runtime accounts and sessions", async () => {
    const postgresClient = new FakePostgresClient();
    const legacyServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
    });
    servers.push(legacyServer);
    const legacyBaseUrl = await listen(legacyServer);

    await jsonFetch(legacyBaseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "legacy@example.com",
        password: "legacy password",
      }),
    });
    expect(JSON.stringify(postgresClient.row?.snapshot_json)).toContain("legacy@example.com");

    await legacyServer.close();
    const postgresAuthClient = new FakePostgresAuthClient();
    const loadedServer = await createPlatformServer({
      postgresClient,
      postgresAuthClient,
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    expect(loadedServer.store.snapshot().auth).toEqual({
      accountCredentials: [],
      sessions: [],
    });

    const created = await jsonFetch(loadedBaseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await jsonFetch(loadedBaseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          {
            userId: accountId,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    });

    expect(postgresClient.row?.snapshot_json).toMatchObject({
      auth: {
        accountCredentials: [],
        sessions: [],
      },
    });
    expect(JSON.stringify(postgresClient.row?.snapshot_json)).not.toContain("legacy@example.com");
  });

  it("recovers Postgres-backed runtime after a snapshot write conflict", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    expect(created.status).toBe(201);

    if (postgresClient.row === undefined) {
      throw new Error("Expected first account mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };

    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });

    expect(conflict).toEqual({
      status: 409,
      contentType: "application/json; charset=utf-8",
      body: {
        error: {
          code: "snapshot_write_conflict",
          message: "Stored draft data changed before this request could be saved. Reload and try again.",
        },
      },
    });
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const failedLocalLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });
    expect(failedLocalLogin).toMatchObject({
      status: 401,
      body: {
        error: {
          code: "invalid_credentials",
        },
      },
    });

    const committedLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    expect(committedLogin.status).toBe(200);
  });

  it("serializes Postgres snapshot-backed HTTP mutations in process", async () => {
    const postgresClient = new FakePostgresClient();
    const firstInsertEntered = deferred();
    const releaseFirstInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: firstInsertEntered.resolve,
      release: releaseFirstInsert.promise,
    };
    const { baseUrl } = await createListeningServer({
      postgresClient,
    });

    const firstCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password",
      }),
    });

    await firstInsertEntered.promise;
    const secondCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password",
      }),
    });

    releaseFirstInsert.resolve();

    await expect(Promise.all([firstCreate, secondCreate])).resolves.toMatchObject([
      { status: 201 },
      { status: 201 },
    ]);
    expect(postgresClient.row?.revision).toBe(2);

    const firstLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "first@example.com",
        password: "secure password",
      }),
    });
    const secondLogin = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "second@example.com",
        password: "secure password",
      }),
    });

    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
  });

  it("rejects unauthenticated and unauthorized screenshot uploads before reading their bodies", async () => {
    let analysisCallCount = 0;
    const { platformServer, baseUrl } = await createListeningServer({
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisCallCount += 1;
          throw new Error("The analyzer must not run for a rejected upload.");
        },
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "screenshot-owner@example.com",
      password: "secure password",
      now,
    });
    const member = await platformServer.app.createAccount({
      email: "screenshot-member@example.com",
      password: "secure password",
      now,
    });
    const ownerLogin = await platformServer.app.login({
      email: owner.email,
      password: "secure password",
      now,
    });
    const memberLogin = await platformServer.app.login({
      email: member.email,
      password: "secure password",
      now,
    });
    if (ownerLogin === null || memberLogin === null) throw new Error("Expected fixture logins.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: ownerLogin.sessionToken,
      season,
      memberships: [
        { userId: owner.id, leagueId: season.leagueId, role: "owner" },
        { userId: member.id, leagueId: season.leagueId, role: "member" },
      ],
      now,
    });
    const path = `/seasons/${season.id}/setup-import/screenshot-analyze`;

    const unauthenticated = await requestBeforeSendingBody(baseUrl, path);
    unauthenticated.request.destroy();
    expect(unauthenticated.response).toMatchObject({
      status: 401,
      body: { error: { code: "auth_required" } },
    });

    const unauthorized = await requestBeforeSendingBody(
      baseUrl,
      path,
      memberLogin.sessionToken,
    );
    unauthorized.request.destroy();
    expect(unauthorized.response).toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    expect(analysisCallCount).toBe(0);
  });

  it("rate limits authorized screenshot uploads before reading their bodies", async () => {
    let ingressAttempts = 0;
    let analysisCallCount = 0;
    const { platformServer, baseUrl } = await createListeningServer({
      screenshotImportIngressRateLimiter: {
        consume: () => {
          ingressAttempts += 1;
          return { allowed: false, remainingAttempts: 0, retryAfterMs: 30_000 };
        },
        reset: () => undefined,
      },
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisCallCount += 1;
          throw new Error("The analyzer must not run for a rate-limited upload.");
        },
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "screenshot-limited@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: owner.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });

    const limited = await requestBeforeSendingBody(
      baseUrl,
      `/seasons/${season.id}/setup-import/screenshot-analyze`,
      login.sessionToken,
    );
    limited.request.destroy();

    expect(limited.response).toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
    });
    expect(ingressAttempts).toBe(1);
    expect(analysisCallCount).toBe(0);
  });

  it("rate limits historical previews by account and client before reading upload bodies", async () => {
    const accountKeys: string[] = [];
    const clientKeys: string[] = [];
    const historicalImports = new AsyncHistoricalImportRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      historicalImportRepository: historicalImports,
      historicalImportAccountRateLimiter: {
        consume: key => {
          accountKeys.push(key);
          return { allowed: true, remainingAttempts: 4, retryAfterMs: 0 };
        },
        reset: () => undefined,
      },
      historicalImportClientRateLimiter: {
        consume: key => {
          clientKeys.push(key);
          return { allowed: false, remainingAttempts: 0, retryAfterMs: 30_000 };
        },
        reset: () => undefined,
      },
    });
    const owner = await platformServer.app.createAccount({
      email: "historical-import-limited@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected historical import fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: owner.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });

    const limited = await requestBeforeSendingBody(
      baseUrl,
      `/seasons/${season.id}/historical-imports/upload-preview`,
      login.sessionToken,
    );
    limited.request.destroy();

    expect(limited.response).toMatchObject({
      status: 429,
      retryAfter: "30",
      body: { error: { code: "rate_limited" } },
    });
    expect(accountKeys).toEqual([owner.id]);
    expect(clientKeys).toEqual(["127.0.0.1"]);
    expect(historicalImports.inner.batches()).toEqual([]);
  });

  it("bounds concurrent historical previews and releases admission for later files", async () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const createEntered = deferred();
    const releaseCreate = deferred();
    const historicalImports = new AsyncHistoricalImportRepository([season], {
      entered: createEntered.resolve,
      release: releaseCreate.promise,
    });
    const { platformServer, baseUrl } = await createListeningServer({
      historicalImportRepository: historicalImports,
      historicalImportMaxConcurrentPerAccount: 1,
      historicalImportMaxConcurrentPerClient: 2,
    });
    const owner = await platformServer.app.createAccount({
      email: "historical-import-concurrent@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: owner.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected historical import fixture login.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: owner.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });
    const path = `/seasons/${season.id}/historical-imports/upload-preview`;
    const uploadBody = (player: string): string => JSON.stringify({
      fileName: `${player}.csv`,
      mimeType: "text/csv",
      base64: Buffer.from(
        `owner,player,position,price,year\nCam,${player},RB,1,2025`,
      ).toString("base64"),
      seasonYear: 2025,
    });
    const firstImport = jsonFetch(baseUrl, path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: uploadBody("Player One"),
    });
    await createEntered.promise;

    const concurrent = await requestBeforeSendingBody(baseUrl, path, login.sessionToken);
    concurrent.request.destroy();
    expect(concurrent.response).toMatchObject({
      status: 429,
      retryAfter: "1",
      body: { error: { code: "historical_import_busy" } },
    });
    expect(historicalImports.inner.batches()).toEqual([]);

    releaseCreate.resolve();
    await expect(firstImport).resolves.toMatchObject({ status: 200 });
    await expect(jsonFetch(baseUrl, path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: uploadBody("Player Two"),
    })).resolves.toMatchObject({ status: 200 });
    expect(historicalImports.inner.batches()).toHaveLength(2);
  });

  it("keeps health checks responsive while screenshot analysis is in flight", async () => {
    const analysisEntered = deferred();
    const releaseAnalysis = deferred();
    const postgresClient = new FakePostgresClient();
    const { platformServer } = await createListeningServer({
      postgresClient,
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisEntered.resolve();
          await releaseAnalysis.promise;
          return {
            leagueName: "League 214674",
            externalLeagueId: "214674",
            teams: ownerOrder.map((manager, index) => ({
              draftOrderPosition: index + 1,
              abbreviation: manager.slice(0, 4).toUpperCase(),
              teamDisplayName: `${manager} Team`,
              managerDisplayNames: [manager],
              confidence: "high" as const,
              issues: [],
              confirmed: false,
            })),
          };
        },
      },
    });
    const account = await platformServer.app.createAccount({
      email: "screenshot-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected screenshot health fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{ userId: account.id, leagueId: season.leagueId, role: "owner" }],
      now,
    });

    const analysis = platformServer.handler({
      method: "POST",
      path: `/seasons/${season.id}/setup-import/screenshot-analyze`,
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "fixture" },
      now,
    });
    await analysisEntered.promise;

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseAnalysis.resolve();
    await expect(analysis).resolves.toMatchObject({ status: 200 });
  });

  it("keeps health checks responsive during league-creation screenshot analysis", async () => {
    const analysisEntered = deferred();
    const releaseAnalysis = deferred();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      leagueMembersScreenshotAnalyzer: {
        analyze: async () => {
          analysisEntered.resolve();
          await releaseAnalysis.promise;
          return {
            leagueName: "League 214674",
            externalLeagueId: "214674",
            teams: ownerOrder.map((manager, index) => ({
              draftOrderPosition: index + 1,
              abbreviation: manager.slice(0, 4).toUpperCase(),
              teamDisplayName: `${manager} Team`,
              managerDisplayNames: [manager],
              confidence: "high" as const,
              issues: [],
              confirmed: false,
            })),
          };
        },
      },
    });
    const account = await platformServer.app.createAccount({
      email: "league-create-screenshot-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected league-creation screenshot fixture login.");

    const analysis = platformServer.handler({
      method: "POST",
      path: "/league-imports/espn/members-screenshot-review",
      sessionToken: login.sessionToken,
      body: { mimeType: "image/png", base64: "fixture" },
      now,
    });
    await analysisEntered.promise;

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseAnalysis.resolve();
    await expect(analysis).resolves.toMatchObject({ status: 200 });
  });

  it("keeps health checks responsive while a season simulation runs outside the snapshot queue", async () => {
    const setupReadEntered = deferred();
    const releaseSetupRead = deferred();
    const simulationEntered = deferred();
    const releaseSimulation = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadEntered.resolve();
        await releaseSetupRead.promise;
        return {
          seasonId: season.id,
          sourceVersion: "simulation-health-test",
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: "simulation-health-test-hash",
          updatedAt: now,
        };
      },
      seasonSimulationRunner: async input => {
        simulationEntered.resolve();
        await releaseSimulation.promise;
        return runSeasonSimulations(input);
      },
    });
    const account = await platformServer.app.createAccount({
      email: "simulation-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected simulation health fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a simulation health fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
      now,
    });

    const simulation = platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });
    await setupReadEntered.promise;
    const queuedMutation = platformServer.handler({
      method: "POST",
      path: "/accounts",
      body: { email: "after-simulation-capture@example.com", password: "secure password" },
      now,
    });
    await expect(Promise.race([
      queuedMutation.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("still-queued"), 50)),
    ])).resolves.toBe("still-queued");
    releaseSetupRead.resolve();
    await expect(Promise.race([
      simulationEntered.promise.then(() => ({ entered: true })),
      simulation.then(response => ({ response })),
    ])).resolves.toEqual({ entered: true });

    await expect(Promise.race([
      queuedMutation,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Mutation remained blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 201 });

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseSimulation.resolve();
    await expect(simulation).resolves.toMatchObject({ status: 200 });
  });

  it("cancels a streamed season simulation on disconnect without saving a run", async () => {
    const simulationEntered = deferred();
    const simulationCanceled = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer, baseUrl } = await createListeningServer({
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "stream-cancel-test",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "stream-cancel-test-hash",
        updatedAt: now,
      }),
      seasonSimulationRunner: async (input, options) => {
        options?.onProgress?.({ completed: 1, total: input.runCount });
        simulationEntered.resolve();
        return await new Promise((_, reject) => {
          const cancel = (): void => {
            simulationCanceled.resolve();
            reject(new Error("Canceled by client disconnect."));
          };
          if (options?.signal?.aborted === true) cancel();
          else options?.signal?.addEventListener("abort", cancel, { once: true });
        });
      },
    });
    const account = await platformServer.app.createAccount({
      email: "stream-cancel@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected stream cancellation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Stream cancellation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a stream cancellation fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
      now,
    });

    const clientRequest = httpRequest(`${baseUrl}/season-simulations`, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
    });
    clientRequest.on("error", () => undefined);
    clientRequest.on("response", response => {
      response.once("data", () => response.destroy());
    });
    clientRequest.end(JSON.stringify({
      seasonId: season.id,
      count: 25,
      strategy: "Target Puka Nacua",
    }));

    await simulationEntered.promise;
    await expect(Promise.race([
      simulationCanceled.promise.then(() => undefined),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Simulation was not canceled.")), 250)),
    ])).resolves.toBeUndefined();
    await expect(platformServer.app.listSimulationRuns({
      actorSessionToken: login.sessionToken,
      seasonId: season.id,
      now,
    })).resolves.toEqual([]);
  });

  it("persists completed season simulation history in the file-backed store", async () => {
    const dataFilePath = await storePath();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      dataFilePath,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "season-simulation-persistence",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "season-simulation-persistence-hash",
        updatedAt: now,
      }),
    });
    const account = await platformServer.app.createAccount({
      email: "season-simulation-persistence@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected season simulation persistence fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Persistent simulations",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a season simulation persistence fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
      now,
    });
    await platformServer.persist();

    await expect(platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    })).resolves.toMatchObject({ status: 200 });

    const saved = JSON.parse(await readFile(dataFilePath, "utf8")) as {
      simulationRuns?: Array<{ status?: string; result?: { seasonSimulation?: { runCount?: number } } }>;
    };
    expect(saved.simulationRuns).toEqual([
      expect.objectContaining({
        status: "completed",
        result: expect.objectContaining({
          seasonSimulation: expect.objectContaining({ runCount: 1 }),
        }),
      }),
    ]);
  });

  it("keeps concurrent simulation input handoffs request-scoped", async () => {
    const firstSetupReadEntered = deferred();
    const releaseFirstSetupRead = deferred();
    const firstSimulationEntered = deferred();
    const secondSimulationEntered = deferred();
    const releaseFirstSimulation = deferred();
    const releaseSecondSimulation = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    let setupReadCount = 0;
    let simulationCount = 0;
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadCount += 1;
        if (setupReadCount === 1) {
          firstSetupReadEntered.resolve();
          await releaseFirstSetupRead.promise;
        }
        return {
          seasonId: season.id,
          sourceVersion: `concurrent-simulation-${setupReadCount}`,
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: `concurrent-simulation-hash-${setupReadCount}`,
          updatedAt: now,
        };
      },
      seasonSimulationRunner: async input => {
        simulationCount += 1;
        if (simulationCount === 1) {
          firstSimulationEntered.resolve();
          await releaseFirstSimulation.promise;
        } else {
          secondSimulationEntered.resolve();
          await releaseSecondSimulation.promise;
        }
        return runSeasonSimulations(input);
      },
    });
    const account = await platformServer.app.createAccount({
      email: "concurrent-simulations@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected concurrent simulation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Concurrent simulation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a concurrent simulation fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
      now,
    });
    const request = () => platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });

    const first = request();
    await firstSetupReadEntered.promise;
    const second = request();
    releaseFirstSetupRead.resolve();
    await firstSimulationEntered.promise;

    await expect(Promise.race([
      secondSimulationEntered.promise.then(() => "started"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), 1_000)),
    ])).resolves.toBe("started");

    releaseFirstSimulation.resolve();
    releaseSecondSimulation.resolve();
    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { status: 200 },
      { status: 200 },
    ]);
  });

  it("serializes Postgres snapshot-backed worker mutations with HTTP mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    await platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "postgres-worker",
      idempotencyKey: "postgres-worker",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();
    expect(postgresClient.row?.revision).toBe(1);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "postgres-worker",
      now,
    });
    const workerInsertEntered = deferred();
    const releaseWorkerInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: workerInsertEntered.resolve,
      release: releaseWorkerInsert.promise,
    };
    const workerDispatch = dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: platformServer.jobHandlers,
    });

    await workerInsertEntered.promise;
    const accountCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });

    releaseWorkerInsert.resolve();

    await expect(workerDispatch).resolves.toBe(job);
    await expect(accountCreate).resolves.toMatchObject({ status: 201 });
    expect(job.status).toBe("completed");
    expect(postgresClient.row?.revision).toBe(3);

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });
    expect(login.status).toBe(200);
  });

  it("runs cached job handlers against the reloaded Postgres runtime", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    const cachedHandlers = platformServer.jobHandlers;
    await platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "cached-handler",
      idempotencyKey: "cached-handler",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    if (postgresClient.row === undefined) {
      throw new Error("Expected setup mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };
    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password",
      }),
    });
    expect(conflict.status).toBe(409);
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "cached-handler",
      now,
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: cachedHandlers,
    })).resolves.toBe(job);
    expect(postgresClient.row?.revision).toBe(3);
    await expect(platformServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
      },
    });
  });

  it("uses an injected async job repository for HTTP enqueue and reads without snapshot persistence", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
    });
    await platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "external-queue",
      idempotencyKey: "external-queue",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulation.id}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-queue-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const jobs = await jsonFetch(baseUrl, "/jobs", {
      headers: { "x-session-token": cam.sessionToken },
    });
    const enqueuedJobId = (enqueued.body as { job: { id: string } }).job.id;
    const canceled = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        now: new Date(now.getTime() + 2_000).toISOString(),
      }),
    });

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(enqueued).toMatchObject({
      status: 202,
      body: {
        job: {
          id: expect.stringMatching(/^job_/),
          userId: cam.account.id,
          leagueId: season.leagueId,
          seasonId: season.id,
          status: "queued",
        },
      },
    });
    expect(jobs).toMatchObject({
      status: 200,
      body: {
        jobs: [
          {
            id: enqueuedJobId,
            status: "queued",
          },
        ],
      },
    });
    expect(canceled).toMatchObject({
      status: 200,
      body: {
        job: {
          id: enqueuedJobId,
          status: "canceled",
        },
      },
    });
    expect(jobRepository.inner.jobs()).toHaveLength(1);
    expect(jobRepository.inner.fetchForUser(enqueuedJobId, cam.account.id)).toMatchObject({
      id: enqueuedJobId,
      status: "canceled",
    });

    const savedSnapshot = JSON.parse(await readFile(dataFilePath, "utf8")) as {
      jobs?: unknown[];
      simulationRuns?: Array<{ id?: unknown; status?: unknown }>;
    };
    expect(savedSnapshot.jobs).toEqual([]);
    expect(savedSnapshot.simulationRuns).toEqual([
      expect.objectContaining({
        id: simulation.id,
        status: "canceled",
      }),
    ]);
  });

  it("uses external job and simulation repositories for private simulation lifecycle without snapshot results", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const simulationRepository = new AsyncSimulationRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
    });
    await platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    await platformServer.persist();

    const created = await jsonFetch(baseUrl, "/simulations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 6,
        seedPrefix: "external-sim",
        idempotencyKey: "external-sim",
        strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
        now: new Date(now.getTime() + 500).toISOString(),
      }),
    });
    const simulationId = (created.body as { simulation: { id: string } }).simulation.id;
    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulationId}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-sim-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const enqueuedJobId = (enqueued.body as { job: { id: string } }).job.id;
    const canceled = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        now: new Date(now.getTime() + 2_000).toISOString(),
      }),
    });
    const rerun = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/rerun`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": cam.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "rerun-external-sim-job",
        now: new Date(now.getTime() + 3_000).toISOString(),
      }),
    });
    const rerunJobId = (rerun.body as { job: { id: string } }).job.id;

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(platformServer.simulationRepository).toBe(simulationRepository);
    expect(created).toMatchObject({
      status: 201,
      body: {
        simulation: {
          id: simulationId,
          status: "requested",
        },
      },
    });
    expect(canceled).toMatchObject({
      status: 200,
      body: {
        job: {
          id: enqueuedJobId,
          status: "canceled",
        },
      },
    });
    expect(await simulationRepository.fetchForUser(simulationId, cam.account.id)).toMatchObject({
      id: simulationId,
      status: "requested",
      result: undefined,
    });

    await expect(dispatchNextPlatformJob({
      repository: jobRepository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 4_000),
      handlers: platformServer.jobHandlers,
    })).resolves.toMatchObject({
      id: rerunJobId,
      status: "completed",
    });
    expect(await simulationRepository.fetchForUser(simulationId, cam.account.id)).toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);

    await expect(loadedServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulationId,
      now: new Date(now.getTime() + 5_000),
    })).resolves.toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
      },
    });

    const savedSnapshot = JSON.parse(await readFile(dataFilePath, "utf8")) as {
      jobs?: unknown[];
      simulationRuns?: unknown[];
    };
    expect(savedSnapshot.jobs).toEqual([]);
    expect(savedSnapshot.simulationRuns).toEqual([]);
  });

  it("does not persist the unrelated snapshot after an external shortlist mutation", async () => {
    const dataFilePath = await storePath();
    const practiceShortlistRepository = new InMemoryPracticeShortlistRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      practiceShortlistRepository,
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
    });
    await platformServer.app.createAccount({
      email: "shortlist-storage@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: "shortlist-storage@example.com",
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected shortlist fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: login.account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
      now,
    });
    await platformServer.persist();
    await rm(dataFilePath, { force: true });
    await mkdir(dataFilePath);

    await expect(jsonFetch(baseUrl, "/practice-shortlist", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: JSON.stringify({
        seasonId: season.id,
        playerName: "Puka Nacua",
      }),
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua" } },
    });
    await expect(practiceShortlistRepository.listForUserSeason(login.account.id, season.id)).resolves.toHaveLength(1);
  });

  it("creates a Postgres job queue when a transactional job client is configured", async () => {
    const postgresJobClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresJobClient });

    expect(platformServer.postgresJobQueue).toBeDefined();
    expect(platformServer.jobRepository).toBe(platformServer.postgresJobQueue);
  });

  it("creates a Postgres simulation repository when a transactional simulation client is configured", async () => {
    const postgresSimulationClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresSimulationClient });

    expect(platformServer.postgresSimulationRepository).toBeDefined();
    expect(platformServer.simulationRepository).toBe(platformServer.postgresSimulationRepository);
  });

  it("uses an external league setup repository for season HTTP routes without snapshot setup writes", async () => {
    const postgresClient = new FakePostgresClient();
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      leagueSetupRepository,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    const memberships = [
      {
        userId: accountId,
        leagueId: season.leagueId,
        role: "owner" as const,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      },
    ];

    const registered = await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships,
      }),
    });

    expect(registered.status).toBe(200);
    expect(platformServer.leagueSetupRepository).toBe(leagueSetupRepository);
    expect(leagueSetupRepository.registerInputs.at(-1)).toMatchObject({
      createdByUserId: accountId,
      season: {
        id: season.id,
        leagueId: season.leagueId,
      },
      memberships,
    });
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      leagueSeasons: [],
      memberships: [],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      leagueSetupRepository,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const loadedSeason = await jsonFetch(loadedBaseUrl, `/seasons/${season.id}`, {
      headers: { "x-session-token": sessionToken },
    });

    expect(loadedSeason).toMatchObject({
      status: 200,
      body: {
        season: {
          id: season.id,
          leagueId: season.leagueId,
        },
      },
    });
  });

  it("creates a Postgres league setup repository when a transactional setup client is configured", async () => {
    const postgresLeagueSetupClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresLeagueSetupClient });

    expect(platformServer.postgresLeagueSetupRepository).toBeDefined();
    expect(platformServer.leagueSetupRepository).toBe(platformServer.postgresLeagueSetupRepository);
  });

  it("uses an external historical import repository for import HTTP routes without snapshot import writes", async () => {
    const postgresClient = new FakePostgresClient();
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const historicalImportRepository = new AsyncHistoricalImportRepository([season]);
    const { baseUrl } = await createListeningServer({
      postgresClient,
      historicalImportRepository,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "cam@example.com",
        password: "secure password",
      }),
    });
    const accountId = (created.body as { account: { id: string } }).account.id;
    const sessionToken = sessionTokenFrom(login);
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    const memberships = [{
      userId: accountId,
      leagueId: season.leagueId,
      role: "owner" as const,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
    }];

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({ season, memberships }),
    });

    const preview = await jsonFetch(baseUrl, `/seasons/${season.id}/historical-imports/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        sourceText: [
          "owner,player,position,price,year,keeper,acquisition",
          "Cam,Ja'Marr Chase,WR,$61,2026,false,auction",
        ].join("\n"),
      }),
    });
    expect(preview).toMatchObject({
      status: 200,
      body: {
        batch: {
          status: "previewed",
        },
      },
    });
    const batchId = (preview.body as { batch: { id: string } }).batch.id;
    const commit = await jsonFetch(baseUrl, `/historical-imports/${batchId}/commit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({ seasonId: season.id, seasonYear: 2026 }),
    });
    expect(commit).toMatchObject({
      status: 200,
      body: {
        batch: {
          id: batchId,
          status: "committed",
        },
      },
    });
    expect(historicalImportRepository.transactionCount).toBe(2);
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      historicalImportBatches: [],
      historicalSaleRecords: [],
      pricingSnapshots: [expect.objectContaining({
        leagueId: season.leagueId,
        seasonYear: season.seasonYear,
        scenarioId: "expected",
      })],
    });
  });

  it("creates a Postgres historical import repository when a transactional import client is configured", async () => {
    const postgresHistoricalImportClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresHistoricalImportClient });

    expect(platformServer.postgresHistoricalImportRepository).toBeDefined();
    expect(platformServer.historicalImportRepository).toBe(platformServer.postgresHistoricalImportRepository);
  });

  it("rejects ambiguous file and Postgres persistence configuration", async () => {
    await expect(createPlatformServer({
      dataFilePath: "/tmp/mockd-platform.json",
      postgresClient: new FakePostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either dataFilePath or postgresClient, not both.");

    await expect(createPlatformServer({
      jobRepository: new AsyncJobRepository(),
      postgresJobClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either jobRepository or postgresJobClient, not both.");

    await expect(createPlatformServer({
      simulationRepository: new AsyncSimulationRepository(),
      postgresSimulationClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either simulationRepository or postgresSimulationClient, not both.");

    await expect(createPlatformServer({
      leagueSetupRepository: new AsyncLeagueSetupRepository(),
      postgresLeagueSetupClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either leagueSetupRepository or postgresLeagueSetupClient, not both.");

    await expect(createPlatformServer({
      historicalImportRepository: new AsyncHistoricalImportRepository(),
      postgresHistoricalImportClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either historicalImportRepository or postgresHistoricalImportClient, not both.");

    const store = new InMemoryPlatformStore();
    await expect(createPlatformServer({
      liveDraftRoomRepository: store.liveDraftRooms,
      postgresLiveDraftRoomClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either liveDraftRoomRepository or postgresLiveDraftRoomClient, not both.");

    await expect(createPlatformServer({
      exportArtifactRepository: store.exportArtifacts,
      postgresExportArtifactClient: new FakeTransactionalPostgresClient(),
      simulationRunner: mockRunner,
    })).rejects.toThrow("Configure either exportArtifactRepository or postgresExportArtifactClient, not both.");
  });

  it("persists worker-completed private simulations in the file-backed store", async () => {
    const dataFilePath = await storePath();
    const { platformServer } = await createListeningServer({ dataFilePath });
    await platformServer.app.createAccount({ email: "cam@example.com", password: "cam password", now });
    const cam = await platformServer.app.login({ email: "cam@example.com", password: "cam password", now });
    if (cam === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "server-worker",
      idempotencyKey: "server-worker",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" }] },
      now,
    });
    await platformServer.persist();

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "server-worker",
      now,
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: platformServer.jobHandlers,
    })).resolves.toBe(job);
    expect(job.status).toBe("completed");

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);

    await expect(loadedServer.app.getSimulationRun({
      actorSessionToken: cam.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      },
    });
  });
});
