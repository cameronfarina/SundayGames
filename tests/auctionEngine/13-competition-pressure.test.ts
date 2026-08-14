import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("raises unmet starter bids when a rival can consolidate a scarce anchor", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: {
        ...positionAmounts(0),
        RB: 1,
      },
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
        Owner03: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      bidVariance: {
        maxDiscount: 0,
        maxPremium: 0,
      },
      budgetPacing: {
        maxDiscount: 0,
      },
      roomPressure: {
        slope: 0,
      },
      scarcity: {
        slope: 0,
      },
      topEndOverbidDamping: {
        maxOverbidDiscount: 0,
      },
      positionOverbidDamping: {},
      contextPenaltyBidDamping: {
        maxOverbidDiscount: 0,
      },
      seed: "rival-anchor-pressure",
    });
    const target = player("Jahmyr Gibbs", "RB", 70);
    const remainingRunningBacks = [
      player("Fallback RB 1", "RB", 1),
      player("Fallback RB 2", "RB", 1),
      player("Fallback RB 3", "RB", 1),
    ];
    const openRoomSale = resolveAuctionSale(
      target,
      createAuctionOwnerStates({ config }),
      remainingRunningBacks,
      config,
    );
    const rivalAnchorSale = resolveAuctionSale(
      target,
      createAuctionOwnerStates({
        config,
        initialRostersByOwner: {
          Owner01: [player("Bijan Robinson", "RB", 70)],
        },
      }),
      remainingRunningBacks,
      config,
    );

    expect(openRoomSale).toBeDefined();
    expect(rivalAnchorSale).toBeDefined();
    if (!openRoomSale) throw new Error("Expected open room sale to resolve.");
    if (!rivalAnchorSale) throw new Error("Expected rival-anchor sale to resolve.");

    const openHoodyBid = openRoomSale.bids.find(bid => bid.owner === "Owner02");
    const pressuredHoodyBid = rivalAnchorSale.bids.find(bid => bid.owner === "Owner02");
    const beatonBid = rivalAnchorSale.bids.find(bid => bid.owner === "Owner01");

    expect(openHoodyBid).toBeDefined();
    expect(pressuredHoodyBid).toBeDefined();
    expect(beatonBid).toBeDefined();
    expect(pressuredHoodyBid?.competitionPressureMultiplier).toBeGreaterThan(1);
    expect(pressuredHoodyBid?.uncappedAmount).toBeGreaterThan(openHoodyBid?.uncappedAmount ?? 0);
    expect(beatonBid?.competitionPressureMultiplier).toBe(1);
  });
});
