import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type {
  ResolveSeasonSimulationPreferencesInput,
  SeasonSimulationPreferenceContext,
} from "./contracts.js";

const teamsPerElitePlayer = 4;

export const createPreferenceContext = (
  input: ResolveSeasonSimulationPreferencesInput,
): SeasonSimulationPreferenceContext => {
  const positionRankMaximum = Math.max(1, Math.ceil(input.season.teams.length / teamsPerElitePlayer));
  const initialRosterByPlayerId = new Map(input.setup.initialRosters.map(player => [
    player.playerId ?? canonicalPlayerIdentityKey(player.playerName),
    player,
  ]));
  const humanKeepers = input.setup.initialRosters.filter(player => player.teamId === input.humanTeamId);
  const openRosterSlots = Math.max(0, input.season.settings.roster.rosterSize - humanKeepers.length);
  const humanPositionCounts = humanKeepers.reduce<Record<string, number>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
  const auctionBudgetRemaining = input.season.settings.draftFormat === "auction"
    ? input.season.settings.auction.budgetDollars
      - humanKeepers.reduce((total, player) => total + player.price, 0)
    : undefined;
  const minimumBid = input.season.settings.draftFormat === "auction"
    ? input.season.settings.auction.minimumBidDollars
    : undefined;

  return {
    input,
    positionRankMaximum,
    initialRosterByPlayerId,
    humanKeepers,
    openRosterSlots,
    humanPositionCounts,
    auctionBudgetRemaining,
    minimumBid,
  };
};
