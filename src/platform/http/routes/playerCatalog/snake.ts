import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../../../liveDraftRooms.js";
import type { BaselinePlayer } from "./baseline.js";

export const snakeCatalogPlayers = (
  players: readonly BaselinePlayer[],
  keeperByPlayer: ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer>,
) => players.map((player, index) => {
  const keeper = keeperByPlayer.get(canonicalPlayerIdentityKey(player.name));
  return {
    ...player,
    marketRank: index + 1,
    leagueRank: index + 1,
    marketValueSource: "baseline_rank",
    isKeeper: keeper !== undefined,
    ...(keeper === undefined ? {} : {
      keeperTeamId: keeper.teamId,
      keeperRound: keeper.keeperRound,
      keeperPrice: keeper.price,
    }),
  };
});
