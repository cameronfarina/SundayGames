import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockState,
} from "../genericAuctionMockEngine.js";
import { isAutomatedAuctionAcquisitionEligible } from "../genericAuctionMockEngine.js";
import {
  activePositionPreferenceFor,
  type ResolvedSeasonSimulationPreference,
} from "../seasonSimulationPreferences.js";
import type { SeasonSimulationTargetConstraint } from "../seasonSimulationTargets.js";
import { SeasonSimulationError } from "./contracts.js";
import { deterministicFraction } from "./constants.js";
import {
  auctionProjectedWeeklyProductionFor,
  auctionRosterNeedFor,
  canAuctionTeamAcquire,
} from "./auctionTargets.js";

export const selectAuctionNomination = (
  state: GenericAuctionMockState,
  targetsByPlayerId: ReadonlyMap<string, SeasonSimulationTargetConstraint>,
  pairPlayerId: string | undefined,
  preferences: readonly ResolvedSeasonSimulationPreference[],
  seed: string,
): GenericAuctionMockBoardPlayer => {
  const humanTeam = state.teams.find(team => team.id === state.configuration.humanTeamId);
  if (humanTeam === undefined) {
    throw new SeasonSimulationError("human_team_missing", "Claim a team before running simulations.");
  }
  const targetPriorityBase = 10_000_000;
  const targetOrderStep = 1_000_000;
  const targetIds = [...targetsByPlayerId.keys()];
  const targetPriorityFor = (playerId: string): number => {
    const index = targetIds.indexOf(playerId);
    return index < 0 ? 0 : targetPriorityBase + (targetIds.length - index) * targetOrderStep;
  };
  const selected = state.board.players
    .filter(player => {
      const target = targetsByPlayerId.get(player.id);
      const isUncappedTarget = target !== undefined && target.maxAuctionPrice === undefined;
      return canAuctionTeamAcquire(state, humanTeam, player)
        && (isUncappedTarget || isAutomatedAuctionAcquisitionEligible(state, humanTeam, player));
    })
    .map(player => ({
      player,
      score: targetPriorityFor(player.id)
        + (player.id === pairPlayerId ? 100_000 : 0)
        + (activePositionPreferenceFor(
          preferences,
          humanTeam.roster,
          player,
          pairPlayerId,
        ) ? 10_000 : 0)
        + (player.week1Projection === 0 ? -10_000 : 0)
        + auctionRosterNeedFor(humanTeam, player.position) * 100
        + (player.humanValue ?? player.expectedPrice)
        + auctionProjectedWeeklyProductionFor(player) * 0.01
        + deterministicFraction(`${seed}:nominate:${state.session.revision}:${player.id}`) * 0.001,
    }))
    .sort((left, right) =>
      right.score - left.score || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (selected === undefined) {
    throw new SeasonSimulationError(
      "simulation_failed",
      "The claimed team cannot fill its remaining auction roster from the available players.",
    );
  }
  return selected;
};
