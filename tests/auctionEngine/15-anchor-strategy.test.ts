import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("can target same-position anchor counts for strategy-specific mock drafts", () => {
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
          anchorAggression: 1.35,
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
      seed: "position-anchor-targets",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [
          player("Existing WR anchor 1", "WR", 46),
          player("Existing WR anchor 2", "WR", 45),
        ],
      },
    });
    const sale = resolveAuctionSale(player("Third anchor RB target", "RB", 45), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.buildStyleMultiplier).toBe(1.35);
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(45);
  });

  it("suppresses non-target anchor bids while a position-anchor strategy is unmet", () => {
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
          anchorAggression: 1.35,
          depthAggression: 0.6,
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
      seed: "position-anchor-target-suppression",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Non-target WR anchor", "WR", 45), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.buildStyleMultiplier).toBe(0.6);
    expect(beatonBid?.uncappedAmount).toBeLessThan(45);
  });
});
