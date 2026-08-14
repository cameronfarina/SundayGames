import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("caps target-position anchor bids to reserve budget for the remaining core", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.5,
          depthAggression: 1,
        },
        Owner02: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Owner01: {
          RB: 3,
        },
      },
      ownerPositionCoreTargets: {
        Owner01: {
          RB: [60, 50, 40],
        },
      },
      seed: "position-core-budget-reserve",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("First elite RB", "RB", 74)],
      },
    });
    const sale = resolveAuctionSale(player("Second too-expensive RB", "RB", 74), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(73);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(73);
    expect(beatonBid?.amount).toBe(73);
  });

  it("caps target-position anchor bids by planned core slot", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.5,
          depthAggression: 1,
        },
        Owner02: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionAnchorTargets: {
        Owner01: {
          RB: 3,
        },
      },
      ownerPositionCoreTargets: {
        Owner01: {
          RB: [60, 50, 40],
        },
      },
      ownerPositionCoreMaxBids: {
        Owner01: {
          RB: [62, 54, 44],
        },
      },
      seed: "position-core-slot-max-bids",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Too-expensive first RB", "RB", 74), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(62);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(62);
    expect(beatonBid?.amount).toBe(62);
  });
});
