import { leagueConfig } from "../../../config/league.js";
import type { Player } from "../../types.js";
import type { AuctionOwnerState } from "../auctionEngine.js";
import { emptyPositionAmounts } from "./defaults.js";

export const watchOwnerCanRoster = (
  watchOwnerState: AuctionOwnerState,
  player: Player,
): boolean => {
  if (watchOwnerState.rosterSlotsRemaining <= 0) return false;

  const counts = emptyPositionAmounts();
  for (const rosteredPlayer of watchOwnerState.roster) {
    counts[rosteredPlayer.position] += 1;
  }
  return counts[player.position] < leagueConfig.rosterMaximums[player.position];
};
