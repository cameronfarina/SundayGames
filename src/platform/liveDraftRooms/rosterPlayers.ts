import { cleanPlayerName, normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomInitialRosterPlayer } from "./contracts/core.js";
import type {
  LiveDraftRoomRosterPlayer,
  LiveDraftRoomSale,
} from "./contracts/players.js";

export const rosterPlayerFromInitial = (
  player: LiveDraftRoomInitialRosterPlayer,
): LiveDraftRoomRosterPlayer => {
  const name = cleanPlayerName(player.playerName);
  return {
    name,
    normalizedPlayerName: normalizePlayerName(name),
    position: player.position,
    price: player.price,
    expectedPrice: player.expectedPrice ?? player.price,
    source: player.source ?? "keeper",
  };
};

export const rosterPlayerFromSale = (
  sale: LiveDraftRoomSale,
): LiveDraftRoomRosterPlayer => ({
  name: sale.playerName,
  normalizedPlayerName: sale.normalizedPlayerName,
  position: sale.position,
  price: sale.price,
  expectedPrice: sale.expectedPrice,
  source: "sale",
  saleEventId: sale.saleEventId,
  ...(sale.teamAbbreviation === undefined ? {} : { teamAbbreviation: sale.teamAbbreviation }),
  ...(sale.byeWeek === undefined ? {} : { byeWeek: sale.byeWeek }),
});
