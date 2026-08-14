import type { LiveDraftRoomEvent } from "./contracts/events.js";
import type { LiveDraftRoomSale } from "./contracts/players.js";

export interface ActiveLiveDraftRoomSale {
  sourceEventId: string;
  sale: LiveDraftRoomSale;
}

export const activeSalesFor = (
  events: readonly LiveDraftRoomEvent[],
): readonly ActiveLiveDraftRoomSale[] => {
  const eventsById = new Map(events.map(event => [event.id, event]));
  const activeSalesBySourceEventId = new Map<string, ActiveLiveDraftRoomSale>();

  for (const event of events) {
    if (event.type === "sale_logged") {
      activeSalesBySourceEventId.set(event.id, { sourceEventId: event.id, sale: event.sale });
    }
    if (event.type === "sale_corrected") {
      activeSalesBySourceEventId.delete(event.correctedSaleEventId);
      activeSalesBySourceEventId.set(event.id, {
        sourceEventId: event.id,
        sale: event.replacementSale,
      });
    }
    if (event.type === "sale_undone") {
      activeSalesBySourceEventId.delete(event.undoneSaleEventId);
      const undoneEvent = eventsById.get(event.undoneSaleEventId);
      if (undoneEvent?.type === "sale_corrected") {
        activeSalesBySourceEventId.set(undoneEvent.correctedSaleEventId, {
          sourceEventId: undoneEvent.correctedSaleEventId,
          sale: undoneEvent.previousSale,
        });
      }
    }
  }
  return [...activeSalesBySourceEventId.values()];
};
