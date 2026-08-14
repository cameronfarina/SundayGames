import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("raises scarcity pressure when bidders have room for multiple same-tier players", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 150,
      rosterSize: 5,
      rosterMaximums: positionAmounts(5),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      positionOverbidDamping: {},
      scarcity: {
        comparablePriceRatio: 0.9,
        minimumComparablePrice: 20,
        slope: 0.15,
        maxMultiplier: 1.5,
      },
      endgameSpend: {
        startRosterSlotsRemaining: 0,
      },
      roomPressure: {
        startRosterSlotsRemaining: 0,
      },
      rosterNeed: {
        lastPositionSlotMultiplier: 1,
      },
      seed: "scarcity-bidder-depth",
    });
    const target = player("Scarce RB", "RB", 32);
    const remainingComparablePlayers = [player("Only comparable RB", "RB", 31)];
    const thinDepthStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [
          player("Owner01 RB 1", "RB", 1),
          player("Owner01 RB 2", "RB", 1),
          player("Owner01 RB 3", "RB", 1),
          player("Owner01 RB 4", "RB", 1),
        ],
        Owner02: [
          player("Owner02 RB 1", "RB", 1),
          player("Owner02 RB 2", "RB", 1),
          player("Owner02 RB 3", "RB", 1),
          player("Owner02 RB 4", "RB", 1),
        ],
        Owner03: [
          player("Owner03 RB 1", "RB", 1),
          player("Owner03 RB 2", "RB", 1),
          player("Owner03 RB 3", "RB", 1),
          player("Owner03 RB 4", "RB", 1),
        ],
      },
    });
    const deepRosterStates = createAuctionOwnerStates({ config });
    const thinDepthSale = resolveAuctionSale(target, thinDepthStates, remainingComparablePlayers, config);
    const deepRosterSale = resolveAuctionSale(target, deepRosterStates, remainingComparablePlayers, config);

    expect(thinDepthSale).toBeDefined();
    expect(deepRosterSale).toBeDefined();
    if (!thinDepthSale) throw new Error("Expected thin-depth sale to resolve.");
    if (!deepRosterSale) throw new Error("Expected deep-roster sale to resolve.");

    const thinDepthTopBid = thinDepthSale.bids[0];
    const deepRosterTopBid = deepRosterSale.bids[0];
    expect(thinDepthTopBid).toBeDefined();
    expect(deepRosterTopBid).toBeDefined();
    expect(deepRosterTopBid?.scarcityMultiplier).toBeGreaterThan(
      thinDepthTopBid?.scarcityMultiplier ?? 0,
    );
    expect(deepRosterTopBid?.uncappedAmount).toBeGreaterThan(thinDepthTopBid?.uncappedAmount ?? 0);
  });
});
