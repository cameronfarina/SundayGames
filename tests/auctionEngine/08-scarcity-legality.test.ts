import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("does not count same-position depth that would strand required starters", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: {
        ...positionAmounts(0),
        RB: 1,
        WR: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      positionOverbidDamping: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 20,
        bidderDepthWeight: 1,
        maxDemandSlotsPerOwner: 2,
        slope: 0.2,
        maxMultiplier: 1.5,
      },
      rosterNeed: {
        missingStarterMultiplier: 1,
        lastPositionSlotMultiplier: 1,
      },
      seed: "scarcity-required-starter-slots",
    });
    const target = player("Starter RB", "RB", 30);
    const sale = resolveAuctionSale(target, createAuctionOwnerStates({ config }), [
      player("Comparable RB 1", "RB", 30),
      player("Comparable RB 2", "RB", 30),
    ], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected required-starter sale to resolve.");

    expect(sale.bids[0]?.scarcityMultiplier).toBe(1);
  });

  it("downweights legal backup bidders in scarcity pressure", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03", "Owner04"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: {
        ...positionAmounts(0),
        QB: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        bidderDepthWeight: 0,
        slope: 0.2,
        maxMultiplier: 1.5,
      },
      rosterNeed: {
        benchQuarterbackMultiplier: 0.5,
      },
      seed: "backup-qb-scarcity-depth",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 starter QB", "QB", 20)],
        Owner02: [player("Owner02 starter QB", "QB", 20)],
        Owner03: [player("Owner03 starter QB", "QB", 20)],
        Owner04: [player("Owner04 starter QB", "QB", 20)],
      },
    });
    const sale = resolveAuctionSale(player("Backup QB", "QB", 18), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected backup QB sale to resolve.");

    expect(sale.bids[0]?.scarcityMultiplier).toBeLessThan(1.3);
  });
});
