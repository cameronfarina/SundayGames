import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { jsonbParameter } from "./json.js";
import {
  compactSnapshotJsonForRoom,
  fullSnapshotJsonForRoom,
  snapshotHashFor,
} from "./snapshotCodec.js";

const compactSnapshotWindow = 2;

export const insertDraftRoomSnapshot = async (
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
