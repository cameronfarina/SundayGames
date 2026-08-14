import type { LiveDraftRoom, LiveDraftRoomEvent } from "../liveDraftRooms.js";
import type { DraftRoomEventPersistenceRow } from "./contracts.js";
import { recordValue, stringValue } from "./json.js";
import {
  incompleteTeamsValue,
  initialRostersValue,
  playerCatalogValue,
  saleValue,
} from "./payloadValues.js";

export const persistedEventFromRow = (
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
        initialRosters: initialRostersValue(payload.initialRosters),
        playerCatalog: playerCatalogValue(payload.playerCatalog),
      };
    case "sale_logged":
      return { ...common, type: row.event_type, sale: saleValue(payload.sale) };
    case "sale_undone":
      return {
        ...common,
        type: row.event_type,
        undoneSaleEventId: stringValue(payload.undoneSaleEventId),
        undoneSale: saleValue(payload.undoneSale),
      };
    case "sale_corrected":
      return {
        ...common,
        type: row.event_type,
        correctedSaleEventId: stringValue(payload.correctedSaleEventId),
        previousSale: saleValue(payload.previousSale),
        replacementSale: saleValue(payload.replacementSale),
      };
    case "room_ended":
      return {
        ...common,
        type: row.event_type,
        incomplete: payload.incomplete === true,
        incompleteTeams: incompleteTeamsValue(payload.incompleteTeams),
      };
  }
};

export const payloadJsonForEvent = (event: LiveDraftRoomEvent): Record<string, unknown> => {
  switch (event.type) {
    case "sale_logged": return { sale: event.sale };
    case "initial_rosters_synchronized":
      return { initialRosters: event.initialRosters, playerCatalog: event.playerCatalog };
    case "sale_undone":
      return { undoneSaleEventId: event.undoneSaleEventId, undoneSale: event.undoneSale };
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
    case "room_reopened": return {};
    case "room_ended":
      return { incomplete: event.incomplete, incompleteTeams: event.incompleteTeams };
  }
};

export const rawCommandForEvent = (event: LiveDraftRoomEvent): string | null =>
  event.type === "sale_logged"
    ? event.sale.input
    : event.type === "sale_corrected"
      ? event.replacementSale.input
      : null;
