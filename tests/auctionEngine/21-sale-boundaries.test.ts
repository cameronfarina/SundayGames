import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("keeps sub-threshold anchors from crossing the high-price sale boundary", () => {
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
          priceAggression: 1.3,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.3,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      topEndOverbidDamping: {
        startPrice: 50,
        fullEffectPrice: 75,
        maxOverbidDiscount: 0,
      },
      topEndSaleGuard: {
        threshold: 70,
        capBelowThresholdAt: 69,
      },
      seed: "top-end-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Nearly elite RB", "RB", 68);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(68);
    expect(sale.price).toBe(69);
  });

  it("keeps strong WR anchors from crossing into elite sale prices", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Owner01: { WR: 1.08 },
        Owner02: { WR: 1.08 },
        Owner03: { WR: 1.08 },
      },
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Owner03: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.15,
      },
      roomPressure: {
        startRosterSlotsRemaining: 16,
        minRosterSlotsRemainingExclusive: 4,
        targetBudgetPerSlot: 12,
        slope: 0.35,
        maxMultiplier: 1.1,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 60,
      },
      seed: "strong-wr-elite-crossing-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Strong WR", "WR", 56);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.bids[0]?.uncappedAmount).toBeGreaterThanOrEqual(60);
    expect(sale.marketPrice).toBe(56);
    expect(sale.price).toBeGreaterThan(sale.marketPrice);
    expect(sale.price).toBeLessThan(60);
    expect(sale.price).toBeLessThanOrEqual(58);
  });
});
