import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { defined, player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("discounts bids that would strand too little budget for remaining roster slots", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      budgetPacing: {
        targetBudgetPerSlotAfterPurchase: 10,
        slope: 1,
        maxDiscount: 0.5,
        minimumPlayerPrice: 10,
      },
      seed: "budget-pacing",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 early star", "RB", 60)],
        Owner02: [player("Owner02 value start", "WR", 10)],
      },
    });
    const target = player("Budget-stranding WR", "WR", 30);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);

    const winningState = ownerStates.find(state => state.owner === sale.winner);
    if (!winningState) throw new Error("Expected winning owner state.");
    const sortedMaxBids = sale.bids.map(bid => bid.maxBid).sort((left, right) => left - right);
    const middle = Math.floor(sortedMaxBids.length / 2);
    const medianMaxBid = sortedMaxBids.length % 2 === 0
      ? (defined(sortedMaxBids[middle - 1], "Expected lower median bid.") + defined(sortedMaxBids[middle], "Expected upper median bid.")) / 2
      : defined(sortedMaxBids[middle], "Expected median bid.");

    expect(sale.diagnostics.roomPressure).toMatchObject({
      legalBidderCount: sale.bids.length,
      biddersAtOrAboveReserve: sale.bids.filter(bid => bid.amount >= sale.diagnostics.reservePrice).length,
      biddersAtOrAboveAnchor: sale.bids.filter(bid => bid.amount >= target.price).length,
      biddersAtOrAboveSalePrice: sale.bids.filter(bid => bid.amount >= sale.price).length,
      maxBidderMaxBid: Math.max(...sale.bids.map(bid => bid.maxBid)),
      medianBidderMaxBid: medianMaxBid,
      winningOwnerMaxBid: sale.bids[0]?.maxBid,
      winningOwnerBudgetRemainingBefore: winningState.budgetRemaining,
      winningOwnerBudgetPerRosterSlotBefore: winningState.budgetRemaining / winningState.rosterSlotsRemaining,
    });
    expect(sale.diagnostics.roomPressure.cashHeavyBidderCount).toBeGreaterThan(0);
  });
});
