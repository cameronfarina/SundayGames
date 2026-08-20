import type { LiveDraftRoom, LiveDraftRoomEvent } from "../liveDraftRooms.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";

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
      sale.price ?? null,
      sale.expectedPrice,
      event.occurredAt,
    ],
  );
};

export const persistSaleProjection = async (
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
    const undoneEvent = previousRoom.events.find(candidate =>
      candidate.id === event.undoneSaleEventId
    );
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
