import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  DraftRoomSnapshotRow,
  RoomExistsRow,
  StartedRoomRow,
} from "./contracts.js";
import { firstRow } from "./json.js";
import { cloneRoom } from "./snapshotCodec.js";
import { roomFromPersistedSnapshot } from "./snapshotRead.js";

export const hasStartedRoomForSeason = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<boolean> => {
  const result = await client.query<StartedRoomRow>(
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
};

export const hasRoomForSeason = async (
  client: PostgresQueryClient,
  seasonId: string,
): Promise<boolean> => {
  const result = await client.query<RoomExistsRow>(
    `SELECT EXISTS (
        SELECT 1 FROM draft_rooms WHERE league_season_id = $1 AND room_type = 'real'
      ) AS has_room`,
    [seasonId],
  );
  return firstRow(result)?.has_room === true;
};

export const allRooms = async (client: PostgresQueryClient) => {
  const result = await client.query<DraftRoomSnapshotRow>(
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
    const room = await roomFromPersistedSnapshot(client, row.draft_room_id, row.snapshot_json);
    return cloneRoom(room);
  }));
};
