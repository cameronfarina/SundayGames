import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { DraftRoomSnapshotRow } from "./contracts.js";
import { firstRow } from "./json.js";
import { roomFromPersistedSnapshot } from "./snapshotRead.js";

export const latestRoomSnapshotForSeason = async (
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
