import {
  InMemoryLiveDraftRoomRepository,
  type LiveDraftRoom,
  type LiveDraftRoomEvent,
} from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  CompactDraftRoomSnapshotV2,
  DraftRoomEventPersistenceRow,
  DraftRoomSnapshotRow,
} from "./contracts.js";
import { persistedEventFromRow } from "./eventCodec.js";
import { firstRow } from "./json.js";
import { isCompactSnapshot, roomFromSnapshotJson } from "./snapshotCodec.js";

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

export const roomFromPersistedSnapshot = async (
  client: PostgresQueryClient,
  roomId: string,
  snapshotJson: unknown,
): Promise<LiveDraftRoom> => isCompactSnapshot(snapshotJson)
  ? await roomFromCompactSnapshot(client, roomId, snapshotJson)
  : roomFromSnapshotJson(snapshotJson);

export const latestRoomSnapshot = async (
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
