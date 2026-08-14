import type { Owner, Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { ownerCanBidOnPlayer } from "./bidEligibility.js";
import { AuctionEngineConfig, CompleteOwnerAuctionBehavior } from "./configContracts.js";
import { clamp, isFlexEligible, isPremiumPosition, rosterMaximumFor } from "./coreMath.js";
import { countPositions } from "./ownerStates.js";
import { canOwnerCompleteRosterAfterAddingPositionSlots, flexEligibleCount, minimumFlexEligibleCount } from "./rosterRules.js";

export const ownerDemandMultiplierFor = (
  owner: Owner,
  position: Position,
  config: AuctionEngineConfig,
): number =>
  config.ownerDemandMultipliers[owner]?.[position] ?? 1;

export const positionCapacityFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const counts = countPositions(state.roster);
  const maximumLegalSlots = Math.min(
    state.rosterSlotsRemaining,
    Math.max(0, rosterMaximumFor(state.owner, position, config) - counts[position]),
  );
  let capacity = 0;

  for (let slotCount = 1; slotCount <= maximumLegalSlots; slotCount += 1) {
    if (!canOwnerCompleteRosterAfterAddingPositionSlots(state, position, slotCount, config)) break;
    capacity = slotCount;
  }

  return capacity;
};

export const tierDemandSlotsFor = (
  state: AuctionOwnerState,
  position: Position,
  comparablePrice: number,
  config: AuctionEngineConfig,
): number => {
  const affordableComparableSlots = Math.floor(state.maxBid / comparablePrice);
  const demandSlots = Math.min(positionCapacityFor(state, position, config), affordableComparableSlots);
  if (demandSlots <= 0) return 0;

  return clamp(
    demandSlots,
    1,
    Math.max(1, config.scarcity.maxDemandSlotsPerOwner),
  );
};

export const weightedBidderDemandFor = (
  state: AuctionOwnerState,
  player: Player,
  comparablePrice: number,
  config: AuctionEngineConfig,
): number => {
  const demandSlots = tierDemandSlotsFor(state, player.position, comparablePrice, config);
  const depthDemand = 1 + Math.max(0, demandSlots - 1) * Math.max(0, config.scarcity.bidderDepthWeight);
  const needWeight = clamp(rosterNeedMultiplierFor(state, player.position, config), 0, 1.25);
  return depthDemand * needWeight;
};

export const defaultOwnerAuctionBehavior: CompleteOwnerAuctionBehavior = {
  priceAggression: 1,
  scarcityChase: 1,
  replacementPatience: 1,
  anchorAggression: 1,
  depthAggression: 1,
};

export const ownerBehaviorFor = (
  owner: Owner,
  config: AuctionEngineConfig,
): CompleteOwnerAuctionBehavior =>
  ({
    ...defaultOwnerAuctionBehavior,
    ...config.ownerBehaviors[owner],
  });

export const rosterNeedMultiplierFor = (
  state: AuctionOwnerState,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const counts = countPositions(state.roster);
  let multiplier = 1;

  if (counts[position] < config.starterMinimums[position]) {
    multiplier *= config.rosterNeed.missingStarterMultiplier;
  } else if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    multiplier *= config.rosterNeed.missingFlexMultiplier;
  }

  if (isPremiumPosition(position) && counts[position] === 0) {
    multiplier *= config.rosterNeed.emptyPremiumPositionMultiplier;
  }
  if (position === "QB" && config.starterMinimums.QB > 0 && counts.QB >= config.starterMinimums.QB) {
    multiplier *= config.rosterNeed.benchQuarterbackMultiplier;
  }
  if (position === "TE" && config.starterMinimums.TE > 0 && counts.TE >= config.starterMinimums.TE) {
    multiplier *= config.rosterNeed.benchTightEndMultiplier;
  }
  if ((position === "K" || position === "DST") && counts[position] >= 1) {
    multiplier *= config.rosterNeed.specialTeamsBenchMultiplier;
  }
  if (counts[position] >= rosterMaximumFor(state.owner, position, config) - 1) {
    multiplier *= config.rosterNeed.lastPositionSlotMultiplier;
  }

  return multiplier;
};

export const scarcityMultiplierFor = (
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number => {
  const comparablePrice = Math.max(
    config.scarcity.minimumComparablePrice,
    Math.ceil(player.price * config.scarcity.comparablePriceRatio),
  );
  const comparablePlayersRemaining = remainingPlayers
    .filter(candidate => candidate.position === player.position && candidate.price >= comparablePrice)
    .length + 1;
  const activeBidders = ownerStates
    .filter(state => ownerCanBidOnPlayer(state, player, ownerStates, remainingPlayers, config))
    .filter(state => state.maxBid >= comparablePrice)
  const weightedBidderDemand = activeBidders.reduce(
    (total, state) => total + weightedBidderDemandFor(state, player, comparablePrice, config),
    0,
  );
  const pressure = weightedBidderDemand / Math.max(1, comparablePlayersRemaining);

  return clamp(
    1 + Math.max(0, pressure - 1) * config.scarcity.slope,
    1,
    config.scarcity.maxMultiplier,
  );
};
