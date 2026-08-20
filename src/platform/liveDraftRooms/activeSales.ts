import type { LiveDraftRoomEvent } from "./contracts/events.js";
import type { LiveDraftRoomSale } from "./contracts/players.js";

export interface ActiveLiveDraftRoomSale {
  sequenceIndex: number;
  sourceEventId: string;
  sale: LiveDraftRoomSale;
}

export const activeSalesFor = (
  events: readonly LiveDraftRoomEvent[],
): readonly ActiveLiveDraftRoomSale[] => {
  const eventsById = new Map(events.map(event => [event.id, event]));
  const activeSalesBySequence: Array<ActiveLiveDraftRoomSale | undefined> = [];
  const sequenceBySourceEventId = new Map<string, number>();

  for (const event of events) {
    if (event.type === "sale_logged") {
      const openSequence = activeSalesBySequence.findIndex(sale => sale === undefined);
      const sequenceIndex = openSequence === -1 ? activeSalesBySequence.length : openSequence;
      activeSalesBySequence[sequenceIndex] = {
        sequenceIndex,
        sourceEventId: event.id,
        sale: event.sale,
      };
      sequenceBySourceEventId.set(event.id, sequenceIndex);
    }
    if (event.type === "sale_corrected") {
      const sequenceIndex = sequenceBySourceEventId.get(event.correctedSaleEventId);
      if (sequenceIndex === undefined) continue;
      sequenceBySourceEventId.delete(event.correctedSaleEventId);
      activeSalesBySequence[sequenceIndex] = {
        sequenceIndex,
        sourceEventId: event.id,
        sale: event.replacementSale,
      };
      sequenceBySourceEventId.set(event.id, sequenceIndex);
    }
    if (event.type === "sale_undone") {
      const sequenceIndex = sequenceBySourceEventId.get(event.undoneSaleEventId);
      if (sequenceIndex === undefined) continue;
      sequenceBySourceEventId.delete(event.undoneSaleEventId);
      const undoneEvent = eventsById.get(event.undoneSaleEventId);
      if (undoneEvent?.type === "sale_corrected") {
        activeSalesBySequence[sequenceIndex] = {
          sequenceIndex,
          sourceEventId: undoneEvent.correctedSaleEventId,
          sale: undoneEvent.previousSale,
        };
        sequenceBySourceEventId.set(undoneEvent.correctedSaleEventId, sequenceIndex);
      } else activeSalesBySequence[sequenceIndex] = undefined;
    }
  }
  return activeSalesBySequence.flatMap(activeSale =>
    activeSale === undefined ? [] : [activeSale]
  );
};
