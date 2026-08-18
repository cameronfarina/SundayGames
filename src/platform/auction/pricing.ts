import {
  averageRosterNeedFor,
  eligibleAiTeamsFor,
  positionScarcityMultiplierFor,
} from "./auctionAnalysis.js";
import { deterministicFraction } from "./deterministic.js";
import {
  auctionClearingPriceCushionDollars,
  flatPricedAuctionPositions,
} from "./pricingConstants.js";
import { projectedRosterPricesAfterAcquiring } from "./rosterPriceProjection.js";
import { canAcquire, rosterNeedFor } from "./roster.js";
import {
  isAutomatedAuctionAcquisitionEligible,
  maximumAutomatedAuctionBidFor,
} from "./starterEligibility.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export { projectedRosterPricesAfterAcquiring };

export const expectedSecondHighestNoiseFraction = (bidderCount: number): number =>
  bidderCount < 2 ? 0 : (bidderCount - 3) / (bidderCount + 1);

export const aiSpendPacingBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  ignoreExclusions = false,
): number => {
  const targetEndingBudget = state.configuration.ai?.targetEndingBudgetDollars;
  if (
    targetEndingBudget === undefined
    || team.rosterSlotsRemaining <= 0
    || (!ignoreExclusions
      && state.configuration.ai?.spendPacingExcludedPlayerIds?.includes(player.id))
  ) return 0;

  const minimumBid = state.configuration.minimumBidDollars;
  const projectedPrices = projectedRosterPricesAfterAcquiring(state, team, player);
  if (projectedPrices.length !== team.rosterSlotsRemaining) return 0;

  const discretionaryBudget = Math.max(
    0,
    team.budgetRemaining - targetEndingBudget - team.rosterSlotsRemaining * minimumBid,
  );
  const projectedDiscretionaryValue = projectedPrices.reduce(
    (total, price) => total + Math.max(0, price - minimumBid),
    0,
  );
  const playerWeight = Math.max(0, player.expectedPrice - minimumBid);
  const playerShare = projectedDiscretionaryValue === 0
    ? Math.floor(discretionaryBudget / team.rosterSlotsRemaining)
    : Math.ceil(discretionaryBudget * playerWeight / projectedDiscretionaryValue);

  return Math.min(
    team.maxBid,
    minimumBid + playerShare + auctionClearingPriceCushionDollars,
  );
};

export const aiMaxBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  nominationNumber: number,
  ignoreSpendPacingExclusions = false,
): number => {
  if (!canAcquire(state, team, player, state.configuration.minimumBidDollars)) return 0;
  if (!isAutomatedAuctionAcquisitionEligible(state, team, player)) return 0;
  if (flatPricedAuctionPositions.has(player.position)) {
    return Math.min(team.maxBid, state.configuration.minimumBidDollars);
  }

  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const bidMultiplier = tendency?.bidMultiplier
    ?? state.configuration.ai?.defaultBidMultiplier
    ?? 1;
  const positionMultiplier = tendency?.positionBidMultipliers?.[player.position] ?? 1;
  const needDollars = state.configuration.ai?.rosterNeedDollars ?? 1;
  const randomness = tendency?.randomness ?? state.configuration.ai?.randomness ?? 0.08;
  const eligibleAiTeams = eligibleAiTeamsFor(state, player);
  const relativeRosterNeed = rosterNeedFor(team, player.position)
    - averageRosterNeedFor(eligibleAiTeams, player.position);
  const scarcityMultiplier = positionScarcityMultiplierFor(state, player);
  // Market is already a clearing-price estimate, so remove the predictable
  // second-highest-bid lift before applying owner-level random variation.
  const competitionNoiseBias = player.expectedPrice
    * randomness
    * expectedSecondHighestNoiseFraction(eligibleAiTeams.length);
  const noise = (
    deterministicFraction(
      `${state.session.seed}:bid:${nominationNumber}:${team.id}:${player.id}`,
    ) * 2 - 1
  ) * player.expectedPrice * randomness;
  const willingness = Math.max(0, Math.round(
    player.expectedPrice * bidMultiplier * positionMultiplier
    + player.expectedPrice * (scarcityMultiplier - 1)
    + relativeRosterNeed * needDollars
    + noise
    - competitionNoiseBias,
  ));

  return Math.min(team.maxBid, maximumAutomatedAuctionBidFor(state, team, player), Math.max(
    willingness,
    aiSpendPacingBidFor(state, team, player, ignoreSpendPacingExclusions),
  ));
};
