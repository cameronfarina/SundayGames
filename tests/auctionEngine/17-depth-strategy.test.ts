import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("caps later position slots so a strategy does not buy expensive depth", () => {
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
          anchorAggression: 1,
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
      ownerPositionSlotMaxBids: {
        Owner01: {
          RB: [62, 54, 44, 8],
        },
      },
      seed: "position-slot-depth-max-bids",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [
          player("RB slot 1", "RB", 58),
          player("RB slot 2", "RB", 53),
          player("RB slot 3", "RB", 39),
        ],
      },
    });
    const sale = resolveAuctionSale(player("Too-expensive depth RB", "RB", 28), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.uncappedAmount).toBeGreaterThan(8);
    expect(beatonBid?.strategyBudgetMaxBid).toBe(8);
    expect(beatonBid?.amount).toBe(8);
  });
});
