import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../src/platform/leagueSeason.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { PostgresLiveDraftRoomRepository } from "../src/platform/postgresLiveDraftRooms.js";
import {
  LiveDraftRoomError,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../src/platform/liveDraftRooms.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const commissioner = { userId: "user_commish", leagueId: "league-214674", role: "admin" } as const;

const playerCatalog = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
] as const satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

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
  corrected_by_event_id: string | null;
  created_at: Date;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneDate = (date: Date | null): Date | null =>
  date === null ? null : new Date(date.getTime());

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

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

const cloneSnapshotRow = (row: DraftRoomSnapshotRow): DraftRoomSnapshotRow => ({
  ...row,
  snapshot_json: jsonValue(row.snapshot_json),
  created_at: new Date(row.created_at.getTime()),
});

const cloneSaleRow = (row: DraftRoomSaleRow): DraftRoomSaleRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
});

class FakePostgresLiveDraftRoomClient implements PostgresTransactionalQueryClient {
  readonly rooms = new Map<string, DraftRoomRow>();
  readonly events: DraftRoomEventRow[] = [];
  readonly snapshots: DraftRoomSnapshotRow[] = [];
  readonly sales = new Map<string, DraftRoomSaleRow>();
  readonly queries: Array<{ text: string; values: readonly unknown[]; inTransaction: boolean }> = [];
  transactionCount = 0;

  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const roomBackup = new Map([...this.rooms].map(([id, row]) => [id, cloneRoomRow(row)]));
    const eventsBackup = this.events.map(cloneEventRow);
    const snapshotsBackup = this.snapshots.map(cloneSnapshotRow);
    const salesBackup = new Map([...this.sales].map(([id, row]) => [id, cloneSaleRow(row)]));

    this.#inTransaction = true;
    try {
      return await operation(this);
    } catch (error) {
      this.rooms.clear();
      for (const [id, row] of roomBackup) this.rooms.set(id, row);
      this.events.splice(0, this.events.length, ...eventsBackup);
      this.snapshots.splice(0, this.snapshots.length, ...snapshotsBackup);
      this.sales.clear();
      for (const [id, row] of salesBackup) this.sales.set(id, row);
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values, inTransaction: this.#inTransaction });
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("SELECT snapshot_json FROM draft_room_snapshots")) {
      const [roomId] = values as readonly [string];
      const snapshot = this.snapshots
        .filter(row => row.draft_room_id === roomId)
        .sort((left, right) => normalizedSql.includes("ORDER BY revision ASC")
          ? left.revision - right.revision
          : right.revision - left.revision)[0];

      return {
        rows: snapshot === undefined
          ? []
          : [{ snapshot_json: cloneSnapshotRow(snapshot).snapshot_json } as TRow],
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
      normalizedSql.startsWith("SELECT snapshots.snapshot_json FROM draft_room_snapshots AS snapshots")
      || normalizedSql.startsWith("SELECT snapshots.draft_room_id, snapshots.snapshot_json FROM draft_room_snapshots AS snapshots")
    ) {
      const [seasonId] = values as readonly [string];
      const roomIds = new Set([...this.rooms.values()]
        .filter(room => room.league_season_id === seasonId && room.room_type === "real")
        .map(room => room.id));
      const snapshot = this.snapshots
        .filter(row => roomIds.has(row.draft_room_id))
        .sort((left, right) => right.revision - left.revision)[0];

      return {
        rows: snapshot === undefined
          ? []
          : [{
            draft_room_id: snapshot.draft_room_id,
            snapshot_json: cloneSnapshotRow(snapshot).snapshot_json,
          } as TRow],
      };
    }

    if (normalizedSql.startsWith("SELECT EXISTS") && normalizedSql.includes("FROM draft_rooms")) {
      const [seasonId] = values as readonly [string];
      if (normalizedSql.includes("AS has_room")) {
        const hasRoom = [...this.rooms.values()].some(room =>
          room.league_season_id === seasonId
        );
        return { rows: [{ has_room: hasRoom } as TRow], rowCount: 1 };
      }
      const hasStartedRoom = [...this.rooms.values()].some(room =>
        room.league_season_id === seasonId && room.started_at !== null
      );

      return { rows: [{ has_started_room: hasStartedRoom } as TRow], rowCount: 1 };
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

    if (normalizedSql.startsWith("DELETE FROM draft_rooms")) {
      const [roomId, expectedRevision] = values as readonly [string, number];
      const room = this.rooms.get(roomId);
      const hasStartedOrSaleEvent = this.events.some(event =>
        event.draft_room_id === roomId && [
          "room_started",
          "sale_logged",
          "sale_corrected",
          "sale_undone",
        ].includes(event.event_type)
      );
      if (
        room === undefined
        || room.current_revision !== expectedRevision
        || (room.status !== "setup" && room.status !== "countdown")
        || room.started_at !== null
        || hasStartedOrSaleEvent
      ) {
        return { rows: [], rowCount: 0 };
      }

      this.rooms.delete(roomId);
      this.events.splice(0, this.events.length, ...this.events.filter(event => event.draft_room_id !== roomId));
      this.snapshots.splice(
        0,
        this.snapshots.length,
        ...this.snapshots.filter(snapshot => snapshot.draft_room_id !== roomId),
      );
      for (const [saleId, sale] of this.sales) {
        if (sale.draft_room_id === roomId) this.sales.delete(saleId);
      }

      return { rows: [{ id: roomId } as TRow], rowCount: 1 };
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

      this.snapshots.push({
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
      const baseRevision = this.snapshots
        .filter(snapshot => snapshot.draft_room_id === roomId)
        .reduce((minimum, snapshot) => Math.min(minimum, snapshot.revision), Number.POSITIVE_INFINITY);
      this.snapshots.splice(
        0,
        this.snapshots.length,
        ...this.snapshots.filter(snapshot =>
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
        corrected_by_event_id: null,
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

    if (normalizedSql.startsWith("UPDATE draft_room_sales SET status = 'corrected'")) {
      const [sourceEventId, correctedByEventId] = values as readonly [string, string];
      const sale = [...this.sales.values()].find(candidate => candidate.source_event_id === sourceEventId);
      if (sale === undefined) return { rows: [], rowCount: 0 };

      this.sales.set(sale.id, {
        ...sale,
        status: "corrected",
        corrected_by_event_id: correctedByEventId,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE draft_room_sales SET status = 'active'")) {
      const [sourceEventId] = values as readonly [string];
      const sale = [...this.sales.values()].find(candidate => candidate.source_event_id === sourceEventId);
      if (sale === undefined) return { rows: [], rowCount: 0 };

      this.sales.set(sale.id, {
        ...sale,
        status: "active",
        corrected_by_event_id: null,
      });

      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

const publishedSeason = (): LeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    setupStatus: "published",
    leagueName: "Sunday league",
  });

const publishedSnakeSeason = (): LeagueSeason => {
  const season = publishedSeason();

  return {
    ...season,
    settings: {
      expectedTeamCount: season.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: season.settings.scoring,
      snake: {
        rounds: season.settings.roster.rosterSize,
        order: season.teams.map(team => team.id),
        reversal: "standard",
      },
      roster: season.settings.roster,
      keeperPolicy: season.settings.keeperPolicy,
    },
  };
};

describe("Postgres live draft rooms", () => {
  it("rejects snake hosted rooms before opening a transaction or writing rows", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);

    await expect(repository.createRoom({
      season: publishedSnakeSeason(),
      roomId: "room_snake",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    })).rejects.toThrow(new LiveDraftRoomError(
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    ));
    expect(client.queries).toEqual([]);
    expect(client.rooms.size).toBe(0);
    expect(client.events).toEqual([]);
    expect(client.snapshots).toEqual([]);
  });

  it("persists idempotent keeper and catalog synchronization until the room starts", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const season = publishedSeason();
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam fixture team.");
    const created = await repository.createRoom({
      season,
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const input = {
      seasonId: season.id,
      actor: commissioner,
      initialRosters: [{
        teamId: camTeam.id,
        playerId: "puka nacua",
        playerName: "Puka Nacua",
        position: "WR" as const,
        price: 50,
        expectedPrice: 73,
        source: "keeper" as const,
      }],
      playerCatalog: playerCatalog.map(player => ({
        ...player,
        expectedPrice: player.name === "Jahmyr Gibbs" ? 86 : player.expectedPrice,
      })),
      idempotencyKey: "keepers:version-1",
      now: new Date(now.getTime() + 1_000),
    };

    const synchronized = await repository.synchronizeInitialRostersForSeason(input);
    const retried = await repository.synchronizeInitialRostersForSeason(input);
    const reloaded = await new PostgresLiveDraftRoomRepository(client).getRoom(created.roomId);

    expect(retried).toEqual(synchronized);
    expect(reloaded).toEqual(synchronized);
    expect(reloaded.projection.teams.find(team => team.teamId === camTeam.id)).toMatchObject({
      spent: 50,
      budgetRemaining: 150,
      rosterSlotsRemaining: 15,
      roster: [{ name: "Puka Nacua", source: "keeper", price: 50 }],
    });
    expect(reloaded.projection.board.map(player => player.name)).not.toContain("Puka Nacua");
    expect(reloaded.projection.board).toContainEqual(expect.objectContaining({
      name: "Jahmyr Gibbs",
      expectedPrice: 86,
    }));
    expect(client.events.map(event => [event.revision, event.event_type, event.idempotency_key])).toEqual([
      [1, "room_created", null],
      [2, "initial_rosters_synchronized", "keepers:version-1"],
    ]);
    expect(client.events[1]?.payload_json).toMatchObject({
      initialRosters: input.initialRosters,
      playerCatalog: expect.arrayContaining([
        expect.objectContaining({ name: "Jahmyr Gibbs", expectedPrice: 86 }),
      ]),
    });
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2]);

    await expect(repository.synchronizeInitialRostersForSeason({
      ...input,
      initialRosters: [],
      playerCatalog: [],
      idempotencyKey: "keepers:invalid-catalog",
      now: new Date(now.getTime() + 1_500),
    })).rejects.toThrow(new LiveDraftRoomError(
      "player_not_found",
      "Player catalog must contain at least one player.",
    ));
    await expect(repository.getRoom(created.roomId)).resolves.toEqual(synchronized);
    expect(client.events).toHaveLength(2);
    expect(client.snapshots).toHaveLength(2);

    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: synchronized?.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 2_000),
    });
    await expect(repository.synchronizeInitialRostersForSeason({
      ...input,
      initialRosters: [],
      idempotencyKey: "keepers:version-2",
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new LiveDraftRoomError(
      "room_already_live",
      "Keepers are locked after the live draft starts.",
    ));
    expect(client.events).toHaveLength(started.revision);
  });

  it("transactionally cancels a setup room, unlocks its season, and permits recreation", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const cancellation = {
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "cancel-room",
      now: new Date(now.getTime() + 1_000),
    } as const;

    await expect(repository.cancelRoom(cancellation)).resolves.toBeUndefined();
    await expect(repository.cancelRoom(cancellation)).resolves.toBeUndefined();
    await expect(repository.hasRoomForSeason(created.seasonId)).resolves.toBe(false);
    await expect(repository.getRoom(created.roomId)).rejects.toThrow(new LiveDraftRoomError(
      "room_not_found",
      'Live draft room "room_sunday" was not found.',
    ));
    expect(client.rooms).toHaveLength(0);
    expect(client.events).toHaveLength(0);
    expect(client.snapshots).toHaveLength(0);
    expect(client.queries.find(query => query.text.startsWith("DELETE FROM draft_rooms"))).toMatchObject({
      values: [created.roomId, created.revision],
      inTransaction: true,
    });

    await expect(repository.createRoom({
      season: publishedSeason(),
      roomId: created.roomId,
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({ roomId: created.roomId, seasonId: created.seasonId });
  });

  it("transactionally cancels a room while its scheduled start is counting down", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_countdown",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      startsAt: new Date(now.getTime() + 60_000),
      createdAt: now,
    });

    expect(created.status).toBe("countdown");
    await expect(repository.cancelRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "cancel-countdown",
      now: new Date(now.getTime() + 1_000),
    })).resolves.toBeUndefined();
    await expect(repository.hasRoomForSeason(created.seasonId)).resolves.toBe(false);
  });

  it("rejects stale or started Postgres room cancellation without deleting state", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });

    await expect(repository.cancelRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision - 1,
      idempotencyKey: "cancel-stale",
    })).rejects.toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));

    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    await expect(repository.cancelRoom({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "cancel-started",
    })).rejects.toThrow(new LiveDraftRoomError(
      "room_not_cancellable",
      "Only a draft room that has never started can be cancelled.",
    ));
    await expect(repository.hasRoomForSeason(started.seasonId)).resolves.toBe(true);
    expect(client.rooms).toHaveLength(1);
    expect(client.events.map(event => event.event_type)).toEqual(["room_created", "room_started"]);
  });

  it("creates, mutates, and reloads a live draft room from dedicated Postgres rows", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);

    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await repository.logSaleCommand({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    });
    const reloaded = await new PostgresLiveDraftRoomRepository(client).getRoom("room_sunday");

    expect(sold.revision).toBe(3);
    expect(reloaded).toEqual(sold);
    expect(reloaded.projection.sales.map(sale => sale.playerName)).toEqual(["Puka Nacua"]);
    expect(client.rooms.get("room_sunday")).toMatchObject({
      league_id: "league-214674",
      league_season_id: "league-214674-season-2026",
      status: "live",
      current_revision: 3,
      created_by_user_id: "user_commish",
    });
    expect(client.events.map(event => [event.revision, event.event_type, event.idempotency_key])).toEqual([
      [1, "room_created", null],
      [2, "room_started", "start-room"],
      [3, "sale_logged", "sale-puka"],
    ]);
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2, 3]);
    expect([...client.sales.values()]).toMatchObject([
      {
        source_event_id: "room_sunday-rev-3-sale_logged",
        fantasy_team_id: "league-214674-season-2026-team-11-cam",
        player_name: "Puka Nacua",
        status: "active",
      },
    ]);
  });

  it("transitions an existing full-snapshot room to bounded compact recovery", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_legacy_snapshots",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    const legacySnapshot = client.snapshots.find(snapshot => snapshot.revision === started.revision);
    if (legacySnapshot === undefined) throw new Error("Expected started room snapshot.");
    legacySnapshot.snapshot_json = cloneJson(started);

    const restartedRepository = new PostgresLiveDraftRoomRepository(client);
    const paused = await restartedRepository.pauseRoom({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "pause-room",
      now: new Date(now.getTime() + 2_000),
    });
    const resumed = await restartedRepository.resumeRoom({
      roomId: paused.roomId,
      actor: commissioner,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room",
      now: new Date(now.getTime() + 3_000),
    });

    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 3, 4]);
    expect(client.snapshots.at(-1)?.snapshot_json).toMatchObject({ formatVersion: 2 });
    await expect(new PostgresLiveDraftRoomRepository(client).getRoom(resumed.roomId)).resolves.toEqual(resumed);
  });

  it("bounds compact recovery snapshots and reloads complete event-derived state", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_bounded_snapshots",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    let room = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });

    for (let index = 0; index < 12; index += 1) {
      const pause = room.status === "live";
      room = await (pause ? repository.pauseRoom.bind(repository) : repository.resumeRoom.bind(repository))({
        roomId: room.roomId,
        actor: commissioner,
        expectedRevision: room.revision,
        idempotencyKey: `${pause ? "pause" : "resume"}-${index}`,
        now: new Date(now.getTime() + 2_000 + index),
      });
    }

    const persistedSnapshotBytes = client.snapshots.reduce(
      (total, snapshot) => total + JSON.stringify(snapshot.snapshot_json).length,
      0,
    );
    const baseSnapshotBytes = JSON.stringify(client.snapshots[0]?.snapshot_json).length;
    const reloaded = await new PostgresLiveDraftRoomRepository(client).getRoom(room.roomId);

    expect(client.snapshots).toHaveLength(3);
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 13, 14]);
    expect(persistedSnapshotBytes).toBeLessThan(baseSnapshotBytes * 2);
    for (const snapshot of client.snapshots.slice(1)) {
      expect(snapshot.snapshot_json).toMatchObject({ formatVersion: 2 });
      expect(snapshot.snapshot_json).not.toHaveProperty("events");
      expect(snapshot.snapshot_json).not.toHaveProperty("playerCatalog");
      expect(snapshot.snapshot_json).not.toHaveProperty("projection");
      expect(snapshot.snapshot_json).not.toHaveProperty("season");
    }
    expect(client.events).toHaveLength(14);
    expect(reloaded).toEqual(room);
  });

  it("replays idempotent start and sale mutations without appending duplicate events", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const startInput = {
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    };
    const started = await repository.startRoom(startInput);
    const replayedStart = await repository.startRoom(startInput);
    const saleInput = {
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    } as const;

    const sold = await repository.logSaleCommand(saleInput);
    const replayedSale = await repository.logSaleCommand(saleInput);

    expect(replayedStart).toEqual(started);
    expect(replayedSale).toEqual(sold);
    expect(client.events.map(event => [event.revision, event.event_type, event.idempotency_key])).toEqual([
      [1, "room_created", null],
      [2, "room_started", "start-room"],
      [3, "sale_logged", "sale-puka"],
    ]);
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2, 3]);
    expect(client.sales).toHaveLength(1);
  });

  it("rejects an idempotency key reused with different live room input", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await repository.logSaleCommand({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    });

    await expect(repository.logSaleCommand({
      roomId: sold.roomId,
      actor: commissioner,
      expectedRevision: sold.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Jahmyr Gibbs", price: 72 },
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new LiveDraftRoomError(
      "idempotency_conflict",
      "A draft room mutation already exists for this idempotency key with different input.",
    ));
    expect(client.events).toHaveLength(3);
    expect(client.snapshots).toHaveLength(3);
    expect(client.sales).toHaveLength(1);
  });

  it("rejects stale concurrent mutations and leaves the event log unchanged", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(repository.logSaleCommand({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "sale-stale",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    ));
    expect(client.events.map(event => event.event_type)).toEqual(["room_created", "room_started"]);
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 2]);
    expect(client.sales).toHaveLength(0);
  });

  it("persists undo, incomplete end, and reopen events with contiguous revisions", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    const sold = await repository.logSaleCommand({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    });
    const undone = await repository.undoLastSale({
      roomId: sold.roomId,
      actor: commissioner,
      expectedRevision: sold.revision,
      idempotencyKey: "undo-puka",
      now: new Date(now.getTime() + 3_000),
    });
    const ended = await repository.endRoom({
      roomId: undone.roomId,
      actor: commissioner,
      expectedRevision: undone.revision,
      idempotencyKey: "end-room",
      allowIncomplete: true,
      now: new Date(now.getTime() + 4_000),
    });
    const persistedEndedEvent = client.events.find(event => event.event_type === "room_ended");
    if (persistedEndedEvent === undefined) throw new Error("Expected ended room event.");
    const legacyPayload = persistedEndedEvent.payload_json as {
      incomplete?: boolean;
      incompleteTeams?: unknown;
    };
    delete legacyPayload.incomplete;
    delete legacyPayload.incompleteTeams;
    const reopened = await repository.reopenRoom({
      roomId: ended.roomId,
      actor: commissioner,
      expectedRevision: ended.revision,
      idempotencyKey: "reopen-room",
      now: new Date(now.getTime() + 5_000),
    });
    const reloaded = await new PostgresLiveDraftRoomRepository(client).getRoom("room_sunday");

    expect(ended.status).toBe("ended");
    expect(reopened).toMatchObject({ status: "paused", revision: 6 });
    expect(reopened.endedAt).toBeUndefined();
    expect(reloaded).toEqual(reopened);
    expect(client.events.map(event => [event.revision, event.event_type])).toEqual([
      [1, "room_created"],
      [2, "room_started"],
      [3, "sale_logged"],
      [4, "sale_undone"],
      [5, "room_ended"],
      [6, "room_reopened"],
    ]);
    expect(client.snapshots.map(snapshot => snapshot.revision)).toEqual([1, 5, 6]);
    expect([...client.sales.values()]).toMatchObject([
      {
        source_event_id: "room_sunday-rev-3-sale_logged",
        status: "voided",
        voided_by_event_id: "room_sunday-rev-4-sale_undone",
      },
    ]);
  });

  it("persists pause, resume, correction, and started-season claim locking with repository parity", async () => {
    const client = new FakePostgresLiveDraftRoomClient();
    const repository = new PostgresLiveDraftRoomRepository(client);
    const created = await repository.createRoom({
      season: publishedSeason(),
      roomId: "room_sunday",
      commissionerUserId: "user_commish",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog,
      createdAt: now,
    });
    await expect(repository.hasRoomForSeason(created.seasonId)).resolves.toBe(true);
    await expect(repository.hasStartedRoomForSeason(created.seasonId)).resolves.toBe(false);
    const started = await repository.startRoom({
      roomId: created.roomId,
      actor: commissioner,
      expectedRevision: created.revision,
      idempotencyKey: "start-room",
      now: new Date(now.getTime() + 1_000),
    });
    await expect(repository.hasStartedRoomForSeason(created.seasonId)).resolves.toBe(true);
    const sold = await repository.logSaleCommand({
      roomId: started.roomId,
      actor: commissioner,
      expectedRevision: started.revision,
      idempotencyKey: "sale-puka",
      sale: { ownerText: "Cam", playerName: "Puka Nacua", price: 67 },
      now: new Date(now.getTime() + 2_000),
    });
    const originalSale = sold.projection.sales[0];
    if (originalSale === undefined) throw new Error("Expected original sale fixture.");
    const corrected = await repository.correctSale({
      roomId: sold.roomId,
      actor: commissioner,
      expectedRevision: sold.revision,
      idempotencyKey: "correct-puka",
      saleEventId: originalSale.saleEventId,
      replacementSale: { ownerText: "Seth", playerName: "Puka Nacua", price: 41 },
      now: new Date(now.getTime() + 3_000),
    });
    const paused = await repository.pauseRoom({
      roomId: corrected.roomId,
      actor: commissioner,
      expectedRevision: corrected.revision,
      idempotencyKey: "pause-room",
      now: new Date(now.getTime() + 4_000),
    });
    const resumed = await repository.resumeRoom({
      roomId: paused.roomId,
      actor: commissioner,
      expectedRevision: paused.revision,
      idempotencyKey: "resume-room",
      now: new Date(now.getTime() + 5_000),
    });
    const reloaded = await new PostgresLiveDraftRoomRepository(client).getRoom(created.roomId);

    expect(reloaded).toEqual(resumed);
    expect(reloaded.projection.sales).toEqual([
      expect.objectContaining({ ownerDisplayName: "Seth", playerName: "Puka Nacua", price: 41 }),
    ]);
    expect(client.events.map(event => [event.revision, event.event_type])).toEqual([
      [1, "room_created"],
      [2, "room_started"],
      [3, "sale_logged"],
      [4, "sale_corrected"],
      [5, "room_paused"],
      [6, "room_resumed"],
    ]);
    expect([...client.sales.values()]).toMatchObject([
      {
        source_event_id: originalSale.saleEventId,
        status: "corrected",
        corrected_by_event_id: "room_sunday-rev-4-sale_corrected",
      },
      {
        source_event_id: "room_sunday-rev-4-sale_corrected",
        fantasy_team_id: "league-214674-season-2026-team-04-seth",
        price: 41,
        status: "active",
      },
    ]);

    const restored = await repository.undoLastSale({
      roomId: resumed.roomId,
      actor: commissioner,
      expectedRevision: resumed.revision,
      idempotencyKey: "undo-correction",
      now: new Date(now.getTime() + 6_000),
    });

    expect(restored.projection.sales).toEqual([
      expect.objectContaining({
        saleEventId: originalSale.saleEventId,
        ownerDisplayName: "Cam",
        price: 67,
      }),
    ]);
    expect([...client.sales.values()]).toMatchObject([
      {
        source_event_id: originalSale.saleEventId,
        status: "active",
        corrected_by_event_id: null,
      },
      {
        source_event_id: "room_sunday-rev-4-sale_corrected",
        status: "voided",
        voided_by_event_id: "room_sunday-rev-7-sale_undone",
      },
    ]);
  });
});
