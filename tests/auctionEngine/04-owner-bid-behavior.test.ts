import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { defined, player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("caps overspent owners without globally discounting the next tier", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03", "Owner04"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.25,
      },
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 elite buy", "WR", 80)],
        Owner02: [player("Owner02 elite buy", "WR", 80)],
      },
    });
    const goodPlayer = player("Good-but-not-elite WR", "WR", 50);
    const sale = resolveAuctionSale(
      goodPlayer,
      ownerStates,
      [player("Replacement WR 1", "WR", 1), player("Replacement WR 2", "WR", 1)],
      config,
    );

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(["Owner03", "Owner04"]).toContain(sale.winner);
    expect(sale.price).toBeGreaterThan(goodPlayer.price);
    expect(goodPlayer.price).toBe(50);
    expect(Math.max(...sale.bids.filter(bid => ["Owner01", "Owner02"].includes(bid.owner)).map(bid => bid.amount)))
      .toBeLessThan(goodPlayer.price);
  });

  it("keeps replacement-level player bids at the minimum bid without a late opening bump", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 10,
      rosterSize: 1,
      rosterMaximums: positionAmounts(1),
      starterMinimums: {
        ...positionAmounts(0),
        WR: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Owner01: { WR: 1.4 },
        Owner02: { WR: 1.4 },
      },
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1.3,
          scarcityChase: 1.2,
          replacementPatience: 1.05,
        },
        Owner02: {
          priceAggression: 1.3,
          scarcityChase: 1.2,
          replacementPatience: 1.05,
        },
      },
      scarcity: {
        maxMultiplier: 1.15,
      },
      lateOpeningBid: {
        startRosterSlotsRemaining: 0,
      },
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(
      player("Endgame WR", "WR", 1),
      ownerStates,
      [player("Other Endgame WR", "WR", 1)],
      config,
    );

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected replacement-level sale to resolve.");

    expect(Math.max(...sale.bids.map(bid => bid.amount))).toBe(1);
    expect(sale.price).toBe(1);
  });

  it("lets owner behavior tune aggression and patience separately from market anchor", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1.12,
          scarcityChase: 1.15,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 0.92,
          scarcityChase: 0.85,
          replacementPatience: 0.9,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.1,
        maxMultiplier: 1.2,
      },
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Contested RB", "RB", 40);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const aggressiveBid = defined(sale.bids.find(bid => bid.owner === "Owner01"), "Expected owner bid.");
    const patientBid = defined(sale.bids.find(bid => bid.owner === "Owner02"), "Expected owner bid.");
    expect(sale.winner).toBe("Owner01");
    expect(aggressiveBid.behaviorAggressionMultiplier).toBe(1.12);
    expect(aggressiveBid.amount).toBeGreaterThan(patientBid.amount);
    expect(target.price).toBe(40);
  });
});
