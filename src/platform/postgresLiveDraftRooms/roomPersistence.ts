import { LiveDraftRoomError, type LiveDraftRoom } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { DeletedRoomRow, RevisionUpdateRow } from "./contracts.js";
import { firstRow, jsonbParameter } from "./json.js";
import { currentProjectionJsonForRoom } from "./snapshotCodec.js";

const startedAtFor = (room: LiveDraftRoom): Date | null =>
  room.events.find(event => event.type === "room_started")?.occurredAt ?? null;

export const insertDraftRoom = async (
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
  updated_at,
  current_projection_json
) VALUES ($1, $2, $3, 'real', $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
ON CONFLICT (id) DO NOTHING
RETURNING id
`.trim(),
    [
      room.roomId,
      room.leagueId,
      room.seasonId,
      room.status,
      room.commissionerUserId,
      room.startsAt ?? null,
      startedAtFor(room),
      room.endedAt ?? null,
      room.revision,
      room.createdAt,
      room.updatedAt,
      jsonbParameter(currentProjectionJsonForRoom(room)),
    ],
  );
  if (firstRow(result) === undefined) {
    throw new LiveDraftRoomError(
      "room_already_exists",
      `Live draft room "${room.roomId}" already exists.`,
    );
  }
};

export const updateDraftRoomRevision = async (
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
    updated_at = $6,
    current_projection_json = $8::jsonb
WHERE id = $1
  AND current_revision = $7
RETURNING current_revision
`.trim(),
    [room.roomId, room.status, room.revision, startedAtFor(room), room.endedAt ?? null,
      room.updatedAt, expectedCurrentRevision, jsonbParameter(currentProjectionJsonForRoom(room))],
  );
  if (firstRow(result) === undefined) {
    throw new LiveDraftRoomError(
      "stale_revision",
      "Draft room changed since this action was prepared. Refresh and try again.",
    );
  }
};

export const deleteDraftRoom = async (
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
