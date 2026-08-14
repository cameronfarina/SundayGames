import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("discounts backup tight end bids after an owner has a starter", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: {
        ...positionAmounts(0),
        TE: 1,
      },
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      rosterNeed: {
        benchTightEndMultiplier: 0.6,
      },
      seed: "backup-te-discount",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Kept TE", "TE", 20)],
      },
    });
    const target = player("Backup TE", "TE", 18);
    const sale = resolveAuctionSale(target, ownerStates, [player("Fallback TE", "TE", 1)], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(beatonBid?.rosterNeedMultiplier).toBe(0.6);
    expect(beatonBid?.uncappedAmount).toBeLessThan(target.price);
  });
});
