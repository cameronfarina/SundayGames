import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("raises bids for cash-heavy owners late in the auction", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 4,
      rosterMaximums: positionAmounts(4),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "endgame-pressure",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [
          player("Owner01 bench RB", "RB", 1),
          player("Owner01 bench WR", "WR", 1),
          player("Owner01 bench TE", "TE", 1),
        ],
        Owner02: [
          player("Owner02 starter RB", "RB", 40),
          player("Owner02 starter WR", "WR", 35),
          player("Owner02 bench TE", "TE", 10),
        ],
      },
    });
    const target = player("Late useful WR", "WR", 20);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.endgamePressureMultiplier).toBeGreaterThan(1);
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(target.price);
  });

  it("raises mid-auction bids for cash-heavy owners while depleted owners stay constrained", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        maxMultiplier: 1,
      },
      endgameSpend: {
        startRosterSlotsRemaining: 2,
      },
      budgetPacing: {
        targetBudgetPerSlotAfterPurchase: 10,
        slope: 1,
        maxDiscount: 0.5,
        minimumPlayerPrice: 10,
      },
      roomPressure: {
        startRosterSlotsRemaining: 5,
        minRosterSlotsRemainingExclusive: 2,
        targetBudgetPerSlot: 10,
        slope: 0.6,
        maxMultiplier: 1.2,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 55,
      },
      seed: "mid-auction-pressure",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 early elite", "RB", 75)],
        Owner02: [player("Owner02 early elite", "WR", 74)],
      },
    });
    const target = player("Good scarce RB", "RB", 45);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback RB", "RB", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const pjBid = sale.bids.find(bid => bid.owner === "Owner03");
    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    const hoodyBid = sale.bids.find(bid => bid.owner === "Owner02");
    expect(pjBid).toBeDefined();
    expect(beatonBid).toBeDefined();
    expect(hoodyBid).toBeDefined();
    expect(pjBid?.roomPressureMultiplier).toBeGreaterThan(1);
    expect(pjBid?.endgamePressureMultiplier).toBe(1);
    expect(pjBid?.uncappedAmount).toBeGreaterThan(target.price);
    expect(beatonBid?.roomPressureMultiplier).toBe(1);
    expect(beatonBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(beatonBid?.amount).toBeLessThan(target.price);
    expect(hoodyBid?.roomPressureMultiplier).toBe(1);
    expect(hoodyBid?.budgetPacingMultiplier).toBeLessThan(1);
    expect(hoodyBid?.amount).toBeLessThan(target.price);
  });
});
