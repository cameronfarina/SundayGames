import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../../../liveDraftRooms.js";
import type { BaselinePlayer } from "./baseline.js";

export const snakeCatalogPlayers = (
  players: readonly BaselinePlayer[],
  keeperByPlayer: ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer>,
) => players.map(player => {
  const keeper = keeperByPlayer.get(canonicalPlayerIdentityKey(player.name));
  return {
    ...player,
    leagueRank: player.marketRank,
    marketValueSource: "baseline_rank",
    isKeeper: keeper !== undefined,
    ...(keeper === undefined ? {} : {
      keeperTeamId: keeper.teamId,
      keeperRound: keeper.keeperRound,
      keeperPrice: keeper.price,
    }),
  };
});
