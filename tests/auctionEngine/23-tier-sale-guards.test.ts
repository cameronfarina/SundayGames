import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("keeps near-elite anchors from adding extra $75-plus sales", () => {
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
          priceAggression: 1.25,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.25,
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
        premiumThreshold: 72,
        capBelowPremiumThresholdAt: 74,
      },
      seed: "near-elite-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Near elite RB", "RB", 70);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(70);
    expect(sale.price).toBe(74);
  });

  it("keeps sub-elite anchors from adding extra $80-plus sales", () => {
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
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.2,
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
        eliteThreshold: 80,
        capBelowEliteThresholdAt: 79,
      },
      seed: "elite-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Sub elite RB", "RB", 77);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(77);
    expect(sale.price).toBe(79);
  });

  it("keeps starter-tier anchors from adding extra $40-plus sales", () => {
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
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
        },
      },
      tierSaleGuard: {
        threshold: 40,
        capBelowThresholdAt: 39,
      },
      seed: "starter-tier-sale-guard",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Starter WR", "WR", 39);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.marketPrice).toBe(39);
    expect(sale.price).toBe(39);
  });
});
