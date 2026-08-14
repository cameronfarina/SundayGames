import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import {
  buildAuctionConfig,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("dampens over-anchor bids when sourced context evidence already penalizes the player", () => {
    const owners: Owner[] = ["Owner01", "Owner02", "Owner03"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 200,
      rosterSize: 16,
      rosterMaximums: positionAmounts(16),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {
        Owner01: { WR: 1.08 },
        Owner02: { WR: 1.08 },
        Owner03: { WR: 1.08 },
      },
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Owner02: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
        Owner03: {
          priceAggression: 1.12,
          scarcityChase: 1.1,
          replacementPatience: 1,
        },
      },
      scarcity: {
        comparablePriceRatio: 0.8,
        minimumComparablePrice: 5,
        slope: 0.12,
        maxMultiplier: 1.15,
      },
      roomPressure: {
        startRosterSlotsRemaining: 16,
        minRosterSlotsRemainingExclusive: 4,
        targetBudgetPerSlot: 12,
        slope: 0.35,
        maxMultiplier: 1.1,
        minimumPlayerPrice: 30,
        maximumPlayerPrice: 60,
      },
      seed: "context-penalty-bid-damping",
    });
    const ownerStates = createAuctionOwnerStates({ config });
    const rawTarget = player("Raw Strong WR", "WR", 51);
    const penalizedTarget = {
      ...player("Penalized Strong WR", "WR", 51),
      contextAdjustmentPercent: -0.105,
      contextEvidenceCount: 5,
    };
    const lightlyPenalizedTarget = {
      ...player("Lightly Penalized Strong WR", "WR", 51),
      contextAdjustmentPercent: -0.045,
      contextEvidenceCount: 5,
    };
    const rawSale = resolveAuctionSale(rawTarget, ownerStates, [], config);
    const penalizedSale = resolveAuctionSale(penalizedTarget, ownerStates, [], config);
    const lightlyPenalizedSale = resolveAuctionSale(lightlyPenalizedTarget, ownerStates, [], config);

    expect(rawSale).toBeDefined();
    expect(penalizedSale).toBeDefined();
    expect(lightlyPenalizedSale).toBeDefined();
    if (!rawSale) throw new Error("Expected raw sale to resolve.");
    if (!penalizedSale) throw new Error("Expected penalized sale to resolve.");
    if (!lightlyPenalizedSale) throw new Error("Expected lightly penalized sale to resolve.");

    expect(rawSale.price).toBeGreaterThan(55);
    expect(penalizedSale.bids[0]?.contextPenaltyDampingMultiplier).toBeLessThan(1);
    expect(penalizedSale.price).toBeLessThan(rawSale.price);
    expect(penalizedSale.price).toBeGreaterThanOrEqual(penalizedTarget.price);
    expect(penalizedSale.price).toBeLessThanOrEqual(55);
    expect(penalizedSale.diagnostics.topBids[0]?.drivers).toContainEqual(
      expect.objectContaining({
        key: "context_penalty_damping",
        direction: "down",
      }),
    );
    expect(lightlyPenalizedSale.bids[0]?.contextPenaltyDampingMultiplier).toBeLessThan(1);
    expect(lightlyPenalizedSale.diagnostics.topBids[0]?.drivers).toContainEqual(
      expect.objectContaining({
        key: "context_penalty_damping",
        direction: "down",
      }),
    );
  });
});
