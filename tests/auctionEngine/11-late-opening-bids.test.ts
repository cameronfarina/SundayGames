import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("lets cash-heavy nominators open late depth players above anchor", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 20,
      rosterSize: 2,
      rosterMaximums: positionAmounts(2),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "late-opening-bid",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 anchor", "RB", 14)],
        Owner02: [player("Owner02 anchor", "WR", 18)],
      },
    });
    const target = player("Late depth WR", "WR", 3);
    const sale = resolveAuctionSale(target, ownerStates, [], config, { nominator: "Owner01" });

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(sale.winner).toBe("Owner01");
    expect(beatonBid?.uncappedAmount).toBe(6);
    expect(sale.price).toBe(6);
  });

  it("starts spending down leftover dollars before the final two roster slots", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 20,
      rosterSize: 4,
      rosterMaximums: positionAmounts(4),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      seed: "earlier-late-opening-bid",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 anchor", "RB", 14)],
        Owner02: [player("Owner02 anchor", "WR", 18)],
      },
    });
    const target = player("Useful depth TE", "TE", 3);
    const sale = resolveAuctionSale(target, ownerStates, [], config, { nominator: "Owner01" });

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    const beatonBid = sale.bids.find(bid => bid.owner === "Owner01");
    expect(beatonBid).toBeDefined();
    expect(sale.diagnostics.nominatorOpeningBid).toBeGreaterThan(target.price);
    expect(beatonBid?.uncappedAmount).toBe(sale.diagnostics.nominatorOpeningBid);
    expect(sale.price).toBe(sale.diagnostics.nominatorOpeningBid);
  });
});
