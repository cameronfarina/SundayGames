import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("preserves a legal roster path for explicit player targets still on the board", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 40,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
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
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      ownerPlayerTargetMaxBids: {
        Owner01: {
          "Jadarian Price": 20,
        },
      },
      seed: "target-path-reservation",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 Keeper", "QB", 1)],
        Owner02: [player("Owner02 Keeper", "QB", 1)],
      },
    });
    const target = player("Jadarian Price", "RB", 13);
    const nonTarget = player("Rico Dowdle", "RB", 12);

    const nonTargetSale = resolveAuctionSale(nonTarget, ownerStates, [target], config);
    const beatonNonTargetBid = nonTargetSale?.bids.find(bid => bid.owner === "Owner01");
    expect(beatonNonTargetBid).toBeUndefined();
    expect(nonTargetSale?.winner).toBe("Owner02");

    const targetSale = resolveAuctionSale(target, ownerStates, [], config);
    expect(targetSale?.winner).toBe("Owner01");
    expect(targetSale?.price).toBeLessThanOrEqual(20);
  });
});
