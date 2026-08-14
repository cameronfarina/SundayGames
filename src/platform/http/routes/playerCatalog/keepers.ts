import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../../../liveDraftRooms.js";

export const keeperByPlayerFor = (
  keepers: readonly LiveDraftRoomInitialRosterPlayer[],
): ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer> => new Map(
  keepers.map(keeper => [canonicalPlayerIdentityKey(keeper.playerName), keeper]),
);
