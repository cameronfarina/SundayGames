import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { DuplicateRealDraftRoomsRow } from "./contracts.js";
import { liveRoomSetupMigrationId } from "./ids.js";

const duplicateRealDraftRoomsSql = `
SELECT
  league_season_id,
  array_agg(id ORDER BY created_at ASC, id ASC) AS room_ids
FROM draft_rooms
WHERE room_type = 'real'
GROUP BY league_season_id
HAVING COUNT(*) > 1
ORDER BY league_season_id ASC;
`.trim();

export const assertNoDuplicateRealDraftRooms = async (
  client: PostgresQueryClient,
): Promise<void> => {
  const result = await client.query<DuplicateRealDraftRoomsRow>(duplicateRealDraftRoomsSql);
  if (result.rows.length === 0) return;

  const duplicates = result.rows
    .map(row => `${row.league_season_id} (${row.room_ids.join(", ")})`)
    .join("; ");
  throw new Error(
    `Cannot apply ${liveRoomSetupMigrationId}: multiple real draft rooms exist for the same season: ${duplicates}. `
    + "Preserve the authoritative room and remove or reclassify the duplicate rooms, then rerun the migration.",
  );
};
