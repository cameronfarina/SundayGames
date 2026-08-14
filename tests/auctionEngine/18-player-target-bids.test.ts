import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("targets named players up to a max bid without forcing the purchase", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
        Owner02: {
          priceAggression: 1.2,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.2,
          depthAggression: 1,
        },
      },
      ownerPlayerTargetMaxBids: {
        Owner01: {
          "Breece Hall": 35,
        },
      },
      seed: "named-player-target-cap",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Breece Hall", "RB", 38), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.playerTargetMaxBid).toBe(35);
    expect(beatonBid?.maxBid).toBe(35);
    expect(beatonBid?.amount).toBe(35);
    expect(sale.winner).toBe("Owner02");
  });

  it("lets explicit player targets override general strategy budget rails", () => {
    const owners: Owner[] = ["Owner01"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPositionSlotMaxBids: {
        Owner01: {
          RB: [8],
        },
      },
      ownerPlayerTargetMaxBids: {
        Owner01: {
          "Breece Hall": 35,
        },
      },
      seed: "player-target-overrides-strategy-rails",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const sale = resolveAuctionSale(player("Breece Hall", "RB", 38), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.strategyBudgetMaxBid).toBe(8);
    expect(beatonBid?.playerTargetMaxBid).toBe(35);
    expect(beatonBid?.maxBid).toBe(35);
    expect(beatonBid?.amount).toBe(35);
    expect(sale.winner).toBe("Owner01");
  });
});
