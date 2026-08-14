import type { LiveDraftRoom, LiveDraftRoomSale } from "../liveDraftRooms.js";
import type { LiveDraftRoomSaleLogEntry } from "./contracts/readModel.js";

export const saleLogEntryFor = (
  sale: LiveDraftRoomSale,
  revision: number,
  occurredAt: Date,
): LiveDraftRoomSaleLogEntry => ({
  saleEventId: sale.saleEventId,
  revision,
  occurredAt: occurredAt.toISOString(),
  teamId: sale.teamId,
  ownerId: sale.ownerId,
  ownerDisplayName: sale.ownerDisplayName,
  teamDisplayName: sale.teamDisplayName,
  playerName: sale.playerName,
  position: sale.position,
  price: sale.price,
  expectedPrice: sale.expectedPrice,
  ...(sale.teamAbbreviation === undefined ? {} : { teamAbbreviation: sale.teamAbbreviation }),
  ...(sale.byeWeek === undefined ? {} : { byeWeek: sale.byeWeek }),
});

export const salesLogFor = (room: LiveDraftRoom): readonly LiveDraftRoomSaleLogEntry[] =>
  room.projection.sales.flatMap(sale => {
    const sourceEvent = room.events.find(event => event.id === sale.saleEventId);
    if (sourceEvent === undefined) return [];

    return [saleLogEntryFor(sale, sourceEvent.revision, sourceEvent.occurredAt)];
  });
