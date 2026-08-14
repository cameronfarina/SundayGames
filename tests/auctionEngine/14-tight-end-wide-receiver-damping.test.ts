import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("damps tight end overbids without changing the TE anchor", () => {
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
        TE: 0.75,
      },
      seed: "te-overbid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const target = player("Elite TE", "TE", 39);
    const sale = resolveAuctionSale(target, ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const bid = sale.bids[0];
    expect(bid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(47);
    expect(sale.marketPrice).toBe(39);
  });

  it("damps wide receiver overbids without changing the WR anchor", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const overrides = {
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
      seed: "wr-overbid-damping",
    };
    const config = buildAuctionConfig(overrides);
    const undampedConfig = buildAuctionConfig({
      ...overrides,
      positionOverbidDamping: {},
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const undampedOwnerStates = createAuctionOwnerStates({ config: undampedConfig });
    const target = player("Strong WR", "WR", 48);
    const sale = resolveAuctionSale(target, ownerStates, [], config);
    const undampedSale = resolveAuctionSale(target, undampedOwnerStates, [], undampedConfig);

    expect(sale).toBeDefined();
    expect(undampedSale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");
    if (!undampedSale) throw new Error("Expected undamped sale to resolve.");

    const bid = sale.bids[0];
    const undampedBid = undampedSale.bids[0];
    expect(bid).toBeDefined();
    expect(undampedBid).toBeDefined();
    expect(bid?.positionOverbidDampingMultiplier).toBeLessThan(1);
    expect(undampedBid?.positionOverbidDampingMultiplier).toBe(1);
    expect(bid?.uncappedAmount).toBeGreaterThanOrEqual(target.price);
    expect(bid?.uncappedAmount).toBeLessThan(undampedBid?.uncappedAmount ?? 0);
    expect(sale.marketPrice).toBe(48);
  });
});
