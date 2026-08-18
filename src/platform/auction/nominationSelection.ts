import { deterministicFraction } from "./deterministic.js";
import { GenericAuctionMockError } from "./errors.js";
import { canAcquire, rosterNeedFor } from "./roster.js";
import {
  isAutomatedAuctionAcquisitionEligible,
  projectedWeeklyProductionFor,
} from "./starterEligibility.js";
import type {
  GenericAuctionMockBoardPlayer,
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

// Owners bring out the best players first, so nominations track player value.
export const nominationScoreFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  nominationNumber: number,
): number => {
  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const positionWeight = tendency?.nominationPositionWeights?.[player.position] ?? 1;
  const needWeight = state.configuration.ai?.rosterNeedDollars ?? 1;

  return player.expectedPrice * positionWeight
    + (player.week1Projection === 0 ? -10_000 : 0)
    + rosterNeedFor(team, player.position) * needWeight
    + projectedWeeklyProductionFor(player) * 0.01
    + deterministicFraction(
      `${state.session.seed}:nomination:${nominationNumber}:${team.id}:${player.id}`,
    ) * 0.001;
};

export const nextNominator = (
  state: GenericAuctionMockState,
): { team: GenericAuctionMockTeamReadModel; index: number } | undefined => {
  for (let offset = 0; offset < state.teams.length; offset += 1) {
    const index = (state.nextNominatorIndex + offset) % state.teams.length;
    const team = state.teams[index];
    if (team !== undefined && team.rosterSlotsRemaining > 0) return { team, index };
  }

  return undefined;
};

export const availableNominationPlayersFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): readonly GenericAuctionMockBoardPlayer[] => state.board.players.filter(player =>
  player.status === "available"
  && canAcquire(state, team, player, state.configuration.minimumBidDollars)
  && (team.isHuman || isAutomatedAuctionAcquisitionEligible(state, team, player)),
);

export const selectAiNomination = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): GenericAuctionMockBoardPlayer => {
  const nominationNumber = state.session.nominationsCompleted + 1;
  const selected = availableNominationPlayersFor(state, team)
    .map(player => ({
      player,
      score: nominationScoreFor(state, team, player, nominationNumber),
    }))
    .sort((left, right) =>
      right.score - left.score
      || right.player.expectedPrice - left.player.expectedPrice
      || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (selected === undefined) {
    throw new GenericAuctionMockError(
      "no_eligible_player",
      `${team.name} cannot fill its remaining roster slots from the available player catalog.`,
    );
  }

  return selected;
};
