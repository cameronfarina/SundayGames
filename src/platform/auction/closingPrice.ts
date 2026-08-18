import {
  flatPricedAuctionDollars,
  flatPricedAuctionPositions,
  maximumSingleBidBudgetShare,
  premiumValueThresholdDollars,
} from "./pricingConstants.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

// The most any single player can cost: 40% of the budget.
export const singleBidCapFor = (
  state: GenericAuctionMockState,
  player: GenericAuctionMockPlayer,
): number => player.expectedPrice >= premiumValueThresholdDollars
  ? Math.round(state.configuration.budgetDollars * maximumSingleBidBudgetShare)
  : Number.MAX_SAFE_INTEGER;

const flatSlotPriceFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
): number => Math.min(
  team.maxBid,
  Math.max(state.configuration.minimumBidDollars, flatPricedAuctionDollars),
);

const isOpen = (slot: { playerId: string | undefined }): boolean => slot.playerId === undefined;

// What filling the team's OTHER open slots should cost: the best remaining
// players at value, one per slot, plus the fixed kicker/defense prices.
const remainingSlotReserveFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): number => {
  const minimumBid = state.configuration.minimumBidDollars;
  const flatOnlySlots = team.slots.filter(slot =>
    isOpen(slot)
    && slot.eligiblePositions.every(position => flatPricedAuctionPositions.has(position))
  ).length;
  const otherFlexibleSlots = team.slots.filter(slot =>
    isOpen(slot)
    && slot.eligiblePositions.some(position => !flatPricedAuctionPositions.has(position))
  ).length - 1;
  const flexibleValues = state.board.players
    .filter(candidate =>
      candidate.status === "available"
      && candidate.id !== player.id
      && !flatPricedAuctionPositions.has(candidate.position))
    .map(candidate => Math.max(minimumBid, candidate.expectedPrice))
    .sort((left, right) => right - left)
    .slice(0, Math.max(0, otherFlexibleSlots));
  return flatOnlySlots * Math.max(minimumBid, flatPricedAuctionDollars)
    + flexibleValues.reduce((total, value) => total + value, 0);
};

// Every owner finishes at exactly $0, and the money lands on the best team,
// not on one slot: a purchase closes at no less than the budget left after
// reserving the value of every other open slot. Early in a draft the board
// is worth more than the budget, so the reserve swallows the floor and the
// sale closes at the standing bid. The floor never pushes a price past the
// winner's own bid ceiling, so style discounts and named-target caps hold.
// Kickers and defenses always close at their flat price.
export const automatedClosingPriceFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
  standingPrice: number,
  bidCeiling: number,
  options: { finalSlotCeiling?: number } = {},
): number => {
  if (flatPricedAuctionPositions.has(player.position)) {
    return Math.max(standingPrice, Math.min(flatSlotPriceFor(state, team), bidCeiling));
  }
  const openFlexibleSlots = team.slots.filter(slot =>
    slot.playerId === undefined
    && slot.eligiblePositions.some(position => !flatPricedAuctionPositions.has(position))
  ).length;
  // A value-based ceiling is self-imposed, so the last flexible purchase
  // ignores it and spends the money; an explicit strategy cap still holds
  // through the caller's finalSlotCeiling.
  const effectiveCeiling = openFlexibleSlots === 1
    ? options.finalSlotCeiling ?? team.maxBid
    : bidCeiling;
  const spendFloor = team.budgetRemaining - remainingSlotReserveFor(state, team, player);
  return Math.max(standingPrice, Math.min(
    team.maxBid,
    effectiveCeiling,
    singleBidCapFor(state, player),
    spendFloor,
  ));
};
