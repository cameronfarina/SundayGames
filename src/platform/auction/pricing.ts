import {
  averageRosterNeedFor,
  eligibleAiTeamsFor,
  positionScarcityMultiplierFor,
  remainingValuePerSlotFor,
} from "./auctionAnalysis.js";
import { backupDepthMaximumBidFor } from "./backupDepth.js";
import { deterministicFraction } from "./deterministic.js";
import { singleBidCapFor } from "./closingPrice.js";
import { ownerBidLiftFor } from "./ownerSurplus.js";
import { flatPricedAuctionDollars, flatPricedAuctionPositions, premiumValueThresholdDollars } from "./pricingConstants.js";
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

export const expectedSecondHighestNoiseFraction = (bidderCount: number): number =>
  bidderCount < 2 ? 0 : (bidderCount - 3) / (bidderCount + 1);

export const aiMaxBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  nominationNumber: number,
): number => {
  if (!canAcquire(state, team, player, state.configuration.minimumBidDollars)) return 0;
  if (!isAutomatedAuctionAcquisitionEligible(state, team, player)) return 0;
  if (flatPricedAuctionPositions.has(player.position)) {
    return Math.min(
      team.maxBid,
      Math.max(state.configuration.minimumBidDollars, flatPricedAuctionDollars),
    );
  }
  const backupDepthMaximum = backupDepthMaximumBidFor(state, team, player);
  if (backupDepthMaximum !== undefined) {
    return Math.min(team.maxBid, backupDepthMaximum);
  }

  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const bidMultiplier = tendency?.bidMultiplier
    ?? state.configuration.ai?.defaultBidMultiplier
    ?? 1;
  const positionMultiplier = tendency?.positionBidMultipliers?.[player.position] ?? 1;
  const premiumMultiplier = player.expectedPrice >= premiumValueThresholdDollars
    ? tendency?.premiumBidMultiplier ?? 1
    : 1;
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
    player.expectedPrice * bidMultiplier * premiumMultiplier * positionMultiplier
    + player.expectedPrice * (scarcityMultiplier - 1)
    + relativeRosterNeed * needDollars
    + noise
    - competitionNoiseBias,
  ));

  return Math.min(
    team.maxBid,
    singleBidCapFor(state, player),
    maximumAutomatedAuctionBidFor(state, team, player),
    willingness + ownerBidLiftFor({
      team,
      position: player.position,
      expectedPrice: player.expectedPrice,
      minimumBid: state.configuration.minimumBidDollars,
      remainingValuePerSlot: remainingValuePerSlotFor(state),
      pressureExempt: state.configuration.ai?.bidPressureExemptPlayerIds
        ?.includes(player.id) ?? false,
    }),
  );
};
