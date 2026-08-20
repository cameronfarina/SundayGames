import type { LiveDraftRoom, LiveDraftRoomEvent } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { DraftRoomEventPersistenceRow } from "./contracts.js";
import { persistedEventFromRow } from "./eventCodec.js";

export const eventsAfterRevision = async (
  client: PostgresQueryClient,
  input: { room: LiveDraftRoom; afterRevision: number },
): Promise<readonly LiveDraftRoomEvent[]> => {
  if (input.afterRevision >= input.room.revision) return [];
  const result = await client.query<DraftRoomEventPersistenceRow>(
    `SELECT
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
  AND revision > $2
  AND revision <= $3
ORDER BY revision ASC`,
    [input.room.roomId, input.afterRevision, input.room.revision],
  );
  return result.rows.map(row => persistedEventFromRow(row, input.room));
};
