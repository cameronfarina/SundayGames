import { createHash } from "node:crypto";
import {
  assertHostedLiveDraftRoomFormat,
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type CorrectLiveDraftRoomSaleInput,
  type CreateLiveDraftRoomInput,
  type EndLiveDraftRoomInput,
  type LiveDraftRoom,
  type LiveDraftRoomAuthorizer,
  type LiveDraftRoomEvent,
  type LiveDraftRoomRepository,
  type LogLiveDraftRoomSaleInput,
  type MutateLiveDraftRoomInput,
  type SynchronizeLiveDraftRoomInitialRostersInput,
} from "./liveDraftRooms.js";
import { deserializePlatformStoreSnapshot } from "./platformStoreSnapshotCodec.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";

interface DraftRoomSnapshotRow {
  draft_room_id?: string;
  snapshot_json: unknown;
}

interface DraftRoomEventPersistenceRow {
  id: string;
  draft_room_id: string;
  revision: number;
  event_type: LiveDraftRoomEvent["type"];
  actor_user_id: string;
  idempotency_key: string | null;
  mutation_hash: string | null;
  payload_json: unknown;
  occurred_at: Date;
}

interface CompactDraftRoomSnapshotV2 {
  formatVersion: 2;
  room: {
    status: LiveDraftRoom["status"];
    revision: number;
    updatedAt: string;
    endedAt: string | null;
  };
}

interface RevisionUpdateRow {
  current_revision: number;
}

interface StartedRoomRow {
  has_started_room: boolean;
}

interface DeletedRoomRow {
  id: string;
}

const compactSnapshotWindow = 2;
const liveDraftRoomStatuses = new Set<LiveDraftRoom["status"]>([
  "setup",
  "countdown",
  "live",
  "paused",
  "ended",
]);

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const cloneRoom = (room: LiveDraftRoom): LiveDraftRoom => structuredClone(room);

const fullSnapshotJsonForRoom = (room: LiveDraftRoom): unknown =>
  JSON.parse(JSON.stringify(room)) as unknown;

const compactSnapshotJsonForRoom = (room: LiveDraftRoom): CompactDraftRoomSnapshotV2 => ({
  formatVersion: 2,
  room: {
    status: room.status,
    revision: room.revision,
    updatedAt: room.updatedAt.toISOString(),
    endedAt: room.endedAt?.toISOString() ?? null,
  },
});

const snapshotHashFor = (snapshotJson: unknown): string =>
  createHash("sha256").update(JSON.stringify(snapshotJson)).digest("hex");

const roomFromSnapshotJson = (value: unknown): LiveDraftRoom => {
  const [room] = deserializePlatformStoreSnapshot({ liveDraftRooms: [value] }).liveDraftRooms;

  if (room === undefined) {
    throw new Error("Postgres draft room snapshot did not contain a live draft room.");
  }

  return room;
};

const recordValue = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Postgres draft room event payload was malformed.");
  }

  return value as Record<string, unknown>;
};

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(new Date(value).getTime());

const isCompactSnapshot = (value: unknown): value is CompactDraftRoomSnapshotV2 => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<CompactDraftRoomSnapshotV2>;
  const room = snapshot.room;

  return snapshot.formatVersion === 2
    && room !== undefined
    && typeof room === "object"
    && liveDraftRoomStatuses.has(room.status)
    && Number.isInteger(room.revision)
    && room.revision > 0
    && isValidDateString(room.updatedAt)
    && (room.endedAt === null || isValidDateString(room.endedAt));
};

const persistedEventFromRow = (
  row: DraftRoomEventPersistenceRow,
  baseRoom: LiveDraftRoom,
): LiveDraftRoomEvent => {
  const payload = recordValue(row.payload_json);
  const common = {
    id: row.id,
    roomId: row.draft_room_id,
    leagueId: baseRoom.leagueId,
    seasonId: baseRoom.seasonId,
    revision: row.revision,
    actorUserId: row.actor_user_id,
    occurredAt: row.occurred_at,
    ...(row.idempotency_key === null ? {} : { idempotencyKey: row.idempotency_key }),
    ...(row.mutation_hash === null ? {} : { mutationHash: row.mutation_hash }),
  };

  switch (row.event_type) {
    case "room_created":
    case "room_started":
    case "room_paused":
    case "room_resumed":
    case "room_reopened":
      return { ...common, type: row.event_type };
    case "initial_rosters_synchronized":
      if (row.idempotency_key === null || row.mutation_hash === null) {
        throw new Error("Postgres initial roster synchronization metadata was malformed.");
      }
      return {
        ...common,
        type: row.event_type,
        idempotencyKey: row.idempotency_key,
        mutationHash: row.mutation_hash,
        initialRosters: payload.initialRosters as readonly LiveDraftRoom["initialRosters"][number][],
        playerCatalog: payload.playerCatalog as LiveDraftRoom["playerCatalog"],
      };
    case "sale_logged":
      return {
        ...common,
        type: row.event_type,
        sale: payload.sale as Extract<LiveDraftRoomEvent, { type: "sale_logged" }>["sale"],
      };
    case "sale_undone":
      return {
        ...common,
        type: row.event_type,
        undoneSaleEventId: String(payload.undoneSaleEventId),
        undoneSale: payload.undoneSale as Extract<LiveDraftRoomEvent, { type: "sale_undone" }>["undoneSale"],
      };
    case "sale_corrected":
      return {
        ...common,
        type: row.event_type,
        correctedSaleEventId: String(payload.correctedSaleEventId),
        previousSale: payload.previousSale as Extract<LiveDraftRoomEvent, { type: "sale_corrected" }>["previousSale"],
        replacementSale: payload.replacementSale as Extract<LiveDraftRoomEvent, { type: "sale_corrected" }>["replacementSale"],
      };
    case "room_ended":
      return {
        ...common,
        type: row.event_type,
        incomplete: payload.incomplete === true,
        incompleteTeams: Array.isArray(payload.incompleteTeams)
          ? payload.incompleteTeams as Extract<LiveDraftRoomEvent, { type: "room_ended" }>["incompleteTeams"]
          : [],
      };
  }
};

const baseRoomSnapshot = async (
  client: PostgresQueryClient,
  roomId: string,
): Promise<LiveDraftRoom> => {
  const result = await client.query<DraftRoomSnapshotRow>(
    `
SELECT snapshot_json
FROM draft_room_snapshots
WHERE draft_room_id = $1
ORDER BY revision ASC
LIMIT 1
`.trim(),
    [roomId],
  );
  const row = firstRow(result);
  if (row === undefined || isCompactSnapshot(row.snapshot_json)) {
    throw new Error("Postgres draft room is missing its full recovery base snapshot.");
  }

  return roomFromSnapshotJson(row.snapshot_json);
};

const persistedEventsThroughRevision = async (
  client: PostgresQueryClient,
  baseRoom: LiveDraftRoom,
  revision: number,
): Promise<readonly LiveDraftRoomEvent[]> => {
  const result = await client.query<DraftRoomEventPersistenceRow>(
    `
SELECT
  id,
  draft_room_id,
  revision,
  event_type,
  actor_user_id,
  idempotency_key,
  mutation_hash,
  payload_json,
  occurred_at
FROM draft_room_events
WHERE draft_room_id = $1
  AND revision <= $2
ORDER BY revision ASC
`.trim(),
    [baseRoom.roomId, revision],
  );

  return result.rows.map(row => persistedEventFromRow(row, baseRoom));
};

const roomFromCompactSnapshot = async (
  client: PostgresQueryClient,
  roomId: string,
  snapshot: CompactDraftRoomSnapshotV2,
): Promise<LiveDraftRoom> => {
  const baseRoom = await baseRoomSnapshot(client, roomId);
  const events = await persistedEventsThroughRevision(client, baseRoom, snapshot.room.revision);
  const hasCompleteHistory = events.length === snapshot.room.revision
    && events.every((event, index) => event.revision === index + 1);
  if (!hasCompleteHistory) {
    throw new Error("Postgres draft room event history was incomplete for its compact snapshot.");
  }
  const latestRosterSync = [...events].reverse().find(
    (event): event is Extract<LiveDraftRoomEvent, { type: "initial_rosters_synchronized" }> =>
      event.type === "initial_rosters_synchronized",
  );
  const { endedAt: _baseEndedAt, ...baseWithoutEndedAt } = baseRoom;
  const hydratedRoom: LiveDraftRoom = {
    ...baseWithoutEndedAt,
    status: snapshot.room.status,
    revision: snapshot.room.revision,
    updatedAt: new Date(snapshot.room.updatedAt),
    ...(snapshot.room.endedAt === null ? {} : { endedAt: new Date(snapshot.room.endedAt) }),
    initialRosters: latestRosterSync?.initialRosters ?? baseRoom.initialRosters,
    playerCatalog: latestRosterSync?.playerCatalog ?? baseRoom.playerCatalog,
    events,
  };
  const repository = new InMemoryLiveDraftRoomRepository();
  repository.replaceRooms([hydratedRoom]);

  return repository.getRoom(roomId);
};

const roomFromPersistedSnapshot = async (
  client: PostgresQueryClient,
  roomId: string,
  snapshotJson: unknown,
): Promise<LiveDraftRoom> => isCompactSnapshot(snapshotJson)
  ? await roomFromCompactSnapshot(client, roomId, snapshotJson)
  : roomFromSnapshotJson(snapshotJson);

const startedAtFor = (room: LiveDraftRoom): Date | null =>
  room.events.find(event => event.type === "room_started")?.occurredAt ?? null;

const endedAtFor = (room: LiveDraftRoom): Date | null => room.endedAt ?? null;

// The current draft_rooms check constraint predates pause; events and snapshots retain the exact state.
const persistedStatusFor = (room: LiveDraftRoom): LiveDraftRoom["status"] => room.status;

const payloadJsonForEvent = (event: LiveDraftRoomEvent): Record<string, unknown> => {
  switch (event.type) {
    case "sale_logged":
      return { sale: event.sale };
    case "initial_rosters_synchronized":
      return {
        initialRosters: event.initialRosters,
        playerCatalog: event.playerCatalog,
      };
    case "sale_undone":
      return {
        undoneSaleEventId: event.undoneSaleEventId,
        undoneSale: event.undoneSale,
      };
    case "sale_corrected":
      return {
        correctedSaleEventId: event.correctedSaleEventId,
        previousSale: event.previousSale,
        replacementSale: event.replacementSale,
      };
    case "room_created":
    case "room_started":
    case "room_paused":
    case "room_resumed":
    case "room_reopened":
      return {};
    case "room_ended":
      return {
        incomplete: event.incomplete,
        incompleteTeams: event.incompleteTeams,
      };
  }
};

const rawCommandForEvent = (event: LiveDraftRoomEvent): string | null =>
  event.type === "sale_logged"
    ? event.sale.input
    : event.type === "sale_corrected"
      ? event.replacementSale.input
      : null;

const latestRoomSnapshot = async (
  client: PostgresQueryClient,
  roomId: string,
): Promise<LiveDraftRoom | undefined> => {
  const result = await client.query<DraftRoomSnapshotRow>(
    `
SELECT snapshot_json
FROM draft_room_snapshots
WHERE draft_room_id = $1
ORDER BY revision DESC
LIMIT 1
`.trim(),
    [roomId],
  );
  const row = firstRow(result);

  return row === undefined ? undefined : await roomFromPersistedSnapshot(client, roomId, row.snapshot_json);
};

const latestRoomSnapshotForSeason = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<LiveDraftRoom | undefined> => {
  const result = await client.query<DraftRoomSnapshotRow>(
    `
SELECT snapshots.draft_room_id, snapshots.snapshot_json
FROM draft_room_snapshots AS snapshots
JOIN draft_rooms AS rooms ON rooms.id = snapshots.draft_room_id
WHERE rooms.league_season_id = $1
  AND rooms.room_type = 'real'
ORDER BY snapshots.revision DESC
LIMIT 1
`.trim(),
    [seasonId],
  );
  const row = firstRow(result);

  return row === undefined || row.draft_room_id === undefined
    ? undefined
    : await roomFromPersistedSnapshot(client, row.draft_room_id, row.snapshot_json);
};

const insertDraftRoom = async (
  client: PostgresQueryClient,
  room: LiveDraftRoom,
): Promise<void> => {
  const result = await client.query<{ id: string }>(
    `
INSERT INTO draft_rooms (
  id,
  league_id,
  league_season_id,
  room_type,
  status,
  created_by_user_id,
  starts_at,
  started_at,
  ended_at,
  current_revision,
  created_at,
  updated_at
) VALUES ($1, $2, $3, 'real', $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (id) DO NOTHING
RETURNING id
`.trim(),
    [
      room.roomId,
      room.leagueId,
      room.seasonId,
      persistedStatusFor(room),
      room.commissionerUserId,
      room.startsAt ?? null,
      startedAtFor(room),
      endedAtFor(room),
      room.revision,
      room.createdAt,
      room.updatedAt,
    ],
  );

  if (firstRow(result) === undefined) {
    throw new LiveDraftRoomError(
      "room_already_exists",
      `Live draft room "${room.roomId}" already exists.`,
    );
  }
};

const updateDraftRoomRevision = async (
  client: PostgresQueryClient,
  room: LiveDraftRoom,
  expectedCurrentRevision: number,
): Promise<void> => {
  const result = await client.query<RevisionUpdateRow>(
    `
UPDATE draft_rooms
SET status = $2,
    current_revision = $3,
    started_at = $4,
    ended_at = $5,
    updated_at = $6
WHERE id = $1
  AND current_revision = $7
RETURNING current_revision
`.trim(),
    [
      room.roomId,
      persistedStatusFor(room),
      room.revision,
      startedAtFor(room),
      endedAtFor(room),
      room.updatedAt,
      expectedCurrentRevision,
    ],
  );

  if (firstRow(result) === undefined) {
    throw new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    );
  }
};

const deleteDraftRoom = async (
  client: PostgresQueryClient,
  roomId: string,
  expectedRevision: number,
): Promise<boolean> => {
  const result = await client.query<DeletedRoomRow>(
    `
DELETE FROM draft_rooms
WHERE id = $1
  AND current_revision = $2
  AND status IN ('setup', 'countdown')
  AND started_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM draft_room_events
    WHERE draft_room_id = $1
      AND event_type IN ('room_started', 'sale_logged', 'sale_corrected', 'sale_undone')
  )
RETURNING id
`.trim(),
    [roomId, expectedRevision],
  );

  return firstRow(result) !== undefined;
};

const insertDraftRoomEvent = async (
  client: PostgresQueryClient,
  event: LiveDraftRoomEvent,
  expectedRevision: number | undefined,
): Promise<void> => {
  await client.query(
    `
INSERT INTO draft_room_events (
  id,
  draft_room_id,
  revision,
  sequence,
  event_type,
  actor_user_id,
  idempotency_key,
  mutation_hash,
  expected_revision,
  raw_command,
  payload_json,
  occurred_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
`.trim(),
    [
      event.id,
      event.roomId,
      event.revision,
      event.revision,
      event.type,
      event.actorUserId,
      event.idempotencyKey ?? null,
      event.mutationHash ?? null,
      expectedRevision ?? null,
      rawCommandForEvent(event),
      jsonbParameter(payloadJsonForEvent(event)),
      event.occurredAt,
    ],
  );
};

const insertDraftRoomSnapshot = async (
  client: PostgresQueryClient,
  room: LiveDraftRoom,
): Promise<void> => {
  const snapshotJson = room.revision === 1
    ? fullSnapshotJsonForRoom(room)
    : compactSnapshotJsonForRoom(room);

  await client.query(
    `
INSERT INTO draft_room_snapshots (
  id,
  draft_room_id,
  revision,
  snapshot_json,
  snapshot_hash,
  created_at
) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
`.trim(),
    [
      `${room.roomId}:snapshot:${room.revision}`,
      room.roomId,
      room.revision,
      jsonbParameter(snapshotJson),
      snapshotHashFor(snapshotJson),
      room.updatedAt,
    ],
  );

  // Keep the immutable full recovery base plus a bounded compact recovery window.
  await client.query(
    `
DELETE FROM draft_room_snapshots
WHERE draft_room_id = $1
  AND revision <> (
    SELECT MIN(revision)
    FROM draft_room_snapshots
    WHERE draft_room_id = $1
  )
  AND revision < $2
`.trim(),
    [room.roomId, Math.max(2, room.revision - compactSnapshotWindow + 1)],
  );
};

const insertActiveSaleProjection = async (
  client: PostgresQueryClient,
  event: Pick<LiveDraftRoomEvent, "id" | "roomId" | "occurredAt">,
  sale: Extract<LiveDraftRoomEvent, { type: "sale_logged" }>["sale"],
): Promise<void> => {
  await client.query(
    `
INSERT INTO draft_room_sales (
  id,
  draft_room_id,
  source_event_id,
  fantasy_team_id,
  player_name,
  normalized_player_name,
  position,
  price,
  expected_price,
  status,
  created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
`.trim(),
    [
      sale.saleEventId,
      event.roomId,
      event.id,
      sale.teamId,
      sale.playerName,
      sale.normalizedPlayerName,
      sale.position,
      sale.price,
      sale.expectedPrice,
      event.occurredAt,
    ],
  );
};

const persistSaleProjection = async (
  client: PostgresQueryClient,
  event: LiveDraftRoomEvent,
  previousRoom: LiveDraftRoom,
): Promise<void> => {
  if (event.type === "sale_logged") {
    await insertActiveSaleProjection(client, event, event.sale);
  }

  if (event.type === "sale_corrected") {
    await client.query(
      `
UPDATE draft_room_sales
SET status = 'corrected',
    corrected_by_event_id = $2
WHERE source_event_id = $1
`.trim(),
      [event.correctedSaleEventId, event.id],
    );
    await insertActiveSaleProjection(client, event, event.replacementSale);
  }

  if (event.type === "sale_undone") {
    await client.query(
      `
UPDATE draft_room_sales
SET status = 'voided',
    voided_by_event_id = $2
WHERE source_event_id = $1
`.trim(),
      [event.undoneSaleEventId, event.id],
    );

    const undoneEvent = previousRoom.events.find(candidate => candidate.id === event.undoneSaleEventId);
    if (undoneEvent?.type === "sale_corrected") {
      await client.query(
        `
UPDATE draft_room_sales
SET status = 'active',
    corrected_by_event_id = NULL
WHERE source_event_id = $1
`.trim(),
        [undoneEvent.correctedSaleEventId],
      );
    }
  }
};

const repositoryForRoom = (
  room: LiveDraftRoom,
  authorizer: LiveDraftRoomAuthorizer | undefined,
): InMemoryLiveDraftRoomRepository => {
  const repository = new InMemoryLiveDraftRoomRepository(authorizer);
  repository.replaceRooms([room]);

  return repository;
};

export class PostgresLiveDraftRoomRepository implements LiveDraftRoomRepository {
  constructor(
    readonly client: PostgresTransactionalQueryClient,
    readonly authorizer?: LiveDraftRoomAuthorizer | undefined,
  ) {}

  async createRoom(input: CreateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    assertHostedLiveDraftRoomFormat(input.season);

    return await this.client.transaction(async client => {
      const existingRoom = await latestRoomSnapshot(client, input.roomId);
      if (existingRoom !== undefined) {
        throw new LiveDraftRoomError(
          "room_already_exists",
          `Live draft room "${input.roomId}" already exists.`,
        );
      }

      const memoryRepository = new InMemoryLiveDraftRoomRepository(this.authorizer);
      const room = memoryRepository.createRoom(input);
      const createdEvent = room.events[0];
      if (createdEvent === undefined) {
        throw new Error("Live draft room creation did not produce an event.");
      }

      await insertDraftRoom(client, room);
      await insertDraftRoomEvent(client, createdEvent, undefined);
      await insertDraftRoomSnapshot(client, room);

      return cloneRoom(room);
    });
  }

  async getRoom(roomId: string): Promise<LiveDraftRoom> {
    const room = await latestRoomSnapshot(this.client, roomId);
    if (room === undefined) {
      throw new LiveDraftRoomError("room_not_found", `Live draft room "${roomId}" was not found.`);
    }

    return cloneRoom(room);
  }

  async getRoomForActor(input: { roomId: string; actor: Parameters<InMemoryLiveDraftRoomRepository["getRoomForActor"]>[0]["actor"] }): Promise<LiveDraftRoom> {
    const room = await this.getRoom(input.roomId);

    return cloneRoom(repositoryForRoom(room, this.authorizer).getRoomForActor(input));
  }

  async hasStartedRoomForSeason(seasonId: string): Promise<boolean> {
    const result = await this.client.query<StartedRoomRow>(
      `
SELECT EXISTS (
  SELECT 1
  FROM draft_rooms
  WHERE league_season_id = $1
    AND started_at IS NOT NULL
) AS has_started_room
`.trim(),
      [seasonId],
    );

    return firstRow(result)?.has_started_room ?? false;
  }

  async hasRoomForSeason(seasonId: string): Promise<boolean> {
    const result = await this.client.query<{ has_room: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM draft_rooms WHERE league_season_id = $1 AND room_type = 'real'
      ) AS has_room`,
      [seasonId],
    );

    return result.rows[0]?.has_room === true;
  }

  async synchronizeInitialRostersForSeason(
    input: SynchronizeLiveDraftRoomInitialRostersInput,
  ): Promise<LiveDraftRoom | null> {
    return await this.client.transaction(async client => {
      const currentRoom = await latestRoomSnapshotForSeason(client, input.seasonId);
      if (currentRoom === undefined) return null;

      const updatedRoom = repositoryForRoom(currentRoom, this.authorizer)
        .synchronizeInitialRostersForSeason(input);
      if (updatedRoom === null) return null;
      if (updatedRoom.revision === currentRoom.revision) return cloneRoom(updatedRoom);

      const newEvent = updatedRoom.events.find(event => event.revision === updatedRoom.revision);
      if (newEvent === undefined) {
        throw new Error(`Live draft room revision ${updatedRoom.revision} did not produce an event.`);
      }

      await updateDraftRoomRevision(client, updatedRoom, currentRoom.revision);
      await insertDraftRoomEvent(client, newEvent, currentRoom.revision);
      await insertDraftRoomSnapshot(client, updatedRoom);

      return cloneRoom(updatedRoom);
    });
  }

  async cancelRoom(input: MutateLiveDraftRoomInput): Promise<void> {
    await this.client.transaction(async client => {
      const currentRoom = await latestRoomSnapshot(client, input.roomId);
      const memoryRepository = currentRoom === undefined
        ? new InMemoryLiveDraftRoomRepository(this.authorizer)
        : repositoryForRoom(currentRoom, this.authorizer);
      memoryRepository.cancelRoom(input);
      if (currentRoom === undefined) return;

      const deleted = await deleteDraftRoom(client, currentRoom.roomId, currentRoom.revision);
      if (deleted) return;

      const concurrentRoom = await latestRoomSnapshot(client, input.roomId);
      if (concurrentRoom === undefined) return;

      throw new LiveDraftRoomError(
        "stale_revision",
        "Draft room changed since this action was prepared. Refresh and try again.",
      );
    });
  }

  async startRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.startRoom(input));
  }

  async pauseRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.pauseRoom(input));
  }

  async resumeRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.resumeRoom(input));
  }

  async reopenRoom(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.reopenRoom(input));
  }

  async logSaleCommand(input: LogLiveDraftRoomSaleInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.logSaleCommand(input));
  }

  async correctSale(input: CorrectLiveDraftRoomSaleInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.correctSale(input));
  }

  async undoLastSale(input: MutateLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.undoLastSale(input));
  }

  async endRoom(input: EndLiveDraftRoomInput): Promise<LiveDraftRoom> {
    return await this.mutateRoom(input, repository => repository.endRoom(input));
  }

  async rooms(): Promise<readonly LiveDraftRoom[]> {
    const result = await this.client.query<DraftRoomSnapshotRow>(
      `
SELECT DISTINCT ON (draft_room_id) draft_room_id, snapshot_json
FROM draft_room_snapshots
ORDER BY draft_room_id, revision DESC
`.trim(),
    );

    return await Promise.all(result.rows.map(async row => {
      if (row.draft_room_id === undefined) {
        throw new Error("Postgres draft room snapshot did not identify its room.");
      }

      return cloneRoom(await roomFromPersistedSnapshot(this.client, row.draft_room_id, row.snapshot_json));
    }));
  }

  private async mutateRoom(
    input: MutateLiveDraftRoomInput,
    mutation: (repository: InMemoryLiveDraftRoomRepository) => LiveDraftRoom,
  ): Promise<LiveDraftRoom> {
    return await this.client.transaction(async client => {
      const currentRoom = await latestRoomSnapshot(client, input.roomId);
      if (currentRoom === undefined) {
        throw new LiveDraftRoomError("room_not_found", `Live draft room "${input.roomId}" was not found.`);
      }

      const updatedRoom = mutation(repositoryForRoom(currentRoom, this.authorizer));
      if (updatedRoom.revision === currentRoom.revision) {
        return cloneRoom(updatedRoom);
      }

      const newEvent = updatedRoom.events.find(event => event.revision === updatedRoom.revision);
      if (newEvent === undefined) {
        throw new Error(`Live draft room revision ${updatedRoom.revision} did not produce an event.`);
      }

      await updateDraftRoomRevision(client, updatedRoom, currentRoom.revision);
      await insertDraftRoomEvent(client, newEvent, input.expectedRevision);
      await persistSaleProjection(client, newEvent, currentRoom);
      await insertDraftRoomSnapshot(client, updatedRoom);

      return cloneRoom(updatedRoom);
    });
  }
}
