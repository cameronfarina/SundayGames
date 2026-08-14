import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("damps only the over-anchor portion of elite bids", () => {
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
        startPrice: 55,
        fullEffectPrice: 75,
        maxOverbidDiscount: 0.65,
      },
      seed: "top-end-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Elite WR", "WR", 75);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.topEndDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(90);
  });

  it("damps quarterback overbids without changing the QB anchor", () => {
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
      positionOverbidDamping: {
        QB: 0.75,
      },
      seed: "qb-overbid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Top QB", "QB", 36);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(43);
    expect(sale.marketPrice).toBe(36);
  });

  it("discounts backup quarterback bids after an owner has a starter", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: {
        ...positionAmounts(0),
        QB: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      rosterNeed: {
        benchQuarterbackMultiplier: 0.5,
      },
      seed: "backup-qb-discount",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Kept QB", "QB", 20)],
      },
    });
    const target = player("Backup QB", "QB", 18);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback QB", "QB", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.rosterNeedMultiplier).toBe(0.5);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);
  });
});
