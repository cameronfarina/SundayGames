import type { LiveDraftRoomEvent } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { payloadJsonForEvent, rawCommandForEvent } from "./eventCodec.js";
import { jsonbParameter } from "./json.js";

export const insertDraftRoomEvent = async (
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
