import type { Player } from "../../types.js";
import { AuctionBid, AuctionOwnerState, AuctionRoomPressureDiagnostics, AuctionSalePriceBasis } from "./auctionContracts.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { average, roundToTwo } from "./coreMath.js";

export const budgetPerRosterSlotFor = (state: AuctionOwnerState): number | null =>
  state.rosterSlotsRemaining <= 0
    ? null
    : roundToTwo(state.budgetRemaining / state.rosterSlotsRemaining);

export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle];
  if (middleValue === undefined) return 0;
  if (sorted.length % 2 !== 0) return middleValue;

  const lowerValue = sorted[middle - 1];
  return lowerValue === undefined
    ? middleValue
    : roundToTwo((lowerValue + middleValue) / 2);
};

export const roomPressureDiagnosticsFor = ({
  bids,
  ownerStates,
  reservePrice,
  anchorPrice,
  salePrice,
  winningBid,
  config,
}: {
  bids: readonly AuctionBid[];
  ownerStates: readonly AuctionOwnerState[];
  reservePrice: number;
  anchorPrice: number;
  salePrice: number;
  winningBid: AuctionBid;
  config: AuctionEngineConfig;
}): AuctionRoomPressureDiagnostics => {
  const stateByOwner = new Map(ownerStates.map(state => [state.owner, state]));
  const bidderStates = bids.flatMap(bid => {
    const state = stateByOwner.get(bid.owner);
    return state ? [state] : [];
  });
  const bidderMaxBids = bids.map(bid => bid.maxBid);
  const winningState = stateByOwner.get(winningBid.owner);

  return {
    legalBidderCount: bids.length,
    biddersAtOrAboveReserve: bids.filter(bid => bid.amount >= reservePrice).length,
    biddersAtOrAboveAnchor: bids.filter(bid => bid.amount >= anchorPrice).length,
    biddersAtOrAboveSalePrice: bids.filter(bid => bid.amount >= salePrice).length,
    cashHeavyBidderCount: bidderStates.filter(state => {
      const budgetPerRosterSlot = budgetPerRosterSlotFor(state);
      return budgetPerRosterSlot !== null && budgetPerRosterSlot >= config.roomPressure.targetBudgetPerSlot;
    }).length,
    maxBidderMaxBid: bidderMaxBids.length === 0 ? 0 : Math.max(...bidderMaxBids),
    medianBidderMaxBid: median(bidderMaxBids),
    averageBidderMaxBid: roundToTwo(average(bidderMaxBids)),
    winningOwnerMaxBid: winningBid.maxBid,
    winningOwnerBudgetRemainingBefore: winningState?.budgetRemaining ?? 0,
    winningOwnerBudgetPerRosterSlotBefore: winningState ? budgetPerRosterSlotFor(winningState) : null,
  };
};

export const salePriceBasisFor = (
  winningBidAmount: number,
  floors: readonly { basis: AuctionSalePriceBasis; amount: number }[],
): AuctionSalePriceBasis => {
  const floor = floors.reduce(
    (highest, candidate) => candidate.amount > highest.amount ? candidate : highest,
    { basis: "minimum_bid", amount: 0 } satisfies { basis: AuctionSalePriceBasis; amount: number },
  );

  return winningBidAmount <= floor.amount ? "winning_bid_cap" : floor.basis;
};

export const topEndSaleGuardPriceFor = (
  player: Player,
  uncappedSalePrice: number,
  config: AuctionEngineConfig,
): number => {
  const guard = config.topEndSaleGuard;
  if (player.price < guard.threshold && uncappedSalePrice >= guard.threshold) {
    return Math.max(player.price, guard.capBelowThresholdAt);
  }

  if (
    player.price < guard.premiumThreshold &&
    uncappedSalePrice >= guard.premiumThreshold
  ) {
    return Math.max(player.price, guard.capBelowPremiumThresholdAt);
  }

  if (
    player.price < guard.eliteThreshold &&
    uncappedSalePrice >= guard.eliteThreshold
  ) {
    return Math.max(player.price, guard.capBelowEliteThresholdAt);
  }

  return uncappedSalePrice;
};

export const tierSaleGuardPriceFor = (
  player: Player,
  salePrice: number,
  config: AuctionEngineConfig,
): number => {
  const guard = config.tierSaleGuard;
  let guardedPrice = salePrice;

  if (player.price < guard.threshold && guardedPrice >= guard.threshold) {
    guardedPrice = Math.max(player.price, guard.capBelowThresholdAt);
  }

  if (player.price < guard.strongThreshold && guardedPrice >= guard.strongThreshold) {
    const tierCap = player.price >= guard.maxPremiumStartPrice
      ? Math.min(
        guard.capBelowStrongThresholdAt,
        player.price + guard.maxPremiumBelowStrongThreshold,
      )
      : guard.capBelowStrongThresholdAt;
    guardedPrice = Math.max(player.price, tierCap);
  }

  return guardedPrice;
};
