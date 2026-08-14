import { describe, expect, it } from "vitest";
import type { Owner } from "../../config/league.js";
import { loadHistoricalAuctionRecords } from "../../src/data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildOwnerAuctionBehaviors,
  buildOwnerRosterMaximums,
  createAuctionOwnerStates,
  resolveAuctionSale,
} from "../../src/modeling/auctionEngine.js";
import { buildOwnerProfiles } from "../../src/modeling/ownerProfiles.js";
import { defined, player, positionAmounts } from "./support.js";

describe("auction engine economics", () => {
  it("derives separate anchor and depth tendencies from owner build profiles", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(historicalRecords);
    const behaviors = buildOwnerAuctionBehaviors(profiles);

    const owner14 = behaviors.Owner14;
    const owner06 = behaviors.Owner06;
    expect(owner14).toBeDefined();
    expect(owner06).toBeDefined();
    if (!owner14 || !owner06) throw new Error("Expected owner behaviors for Owner14 and Owner06.");

    const melloAnchorAggression = owner14.anchorAggression;
    const tyeAnchorAggression = owner06.anchorAggression;
    const melloDepthAggression = owner14.depthAggression;
    const tyeDepthAggression = owner06.depthAggression;
    if (
      melloAnchorAggression === undefined ||
      tyeAnchorAggression === undefined ||
      melloDepthAggression === undefined ||
      tyeDepthAggression === undefined
    ) {
      throw new Error("Expected complete build-style behavior controls.");
    }

    expect(melloAnchorAggression).toBeGreaterThan(tyeAnchorAggression);
    expect(melloDepthAggression).toBeLessThan(tyeDepthAggression);
    expect(melloDepthAggression).toBeLessThan(1);
    expect(tyeDepthAggression).toBeGreaterThan(1);
  });

  it("applies build-style behavior differently to anchor and depth bids", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerDemandMultipliers: {},
      ownerBehaviors: {
        Owner01: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1.1,
          depthAggression: 0.9,
        },
        Owner02: {
          priceAggression: 1,
          scarcityChase: 1,
          replacementPatience: 1,
          anchorAggression: 1,
          depthAggression: 1,
        },
      },
      seed: "build-style-bids",
    });
    const ownerStates = createAuctionOwnerStates({ config });

    const anchorSale = resolveAuctionSale(player("Anchor RB", "RB", 45), ownerStates, [], config);
    expect(anchorSale).toBeDefined();
    if (!anchorSale) throw new Error("Expected anchor sale to resolve.");

    const anchorTopHeavyBid = defined(anchorSale.bids.find(bid => bid.owner === "Owner01"), "Expected owner bid.");
    const anchorBalancedBid = defined(anchorSale.bids.find(bid => bid.owner === "Owner02"), "Expected owner bid.");
    expect(anchorTopHeavyBid.buildStyleMultiplier).toBe(1.1);
    expect(anchorTopHeavyBid.amount).toBeGreaterThan(anchorBalancedBid.amount);

    const depthSale = resolveAuctionSale(player("Depth RB", "RB", 12), ownerStates, [], config);
    expect(depthSale).toBeDefined();
    if (!depthSale) throw new Error("Expected depth sale to resolve.");

    const depthTopHeavyBid = defined(depthSale.bids.find(bid => bid.owner === "Owner01"), "Expected owner bid.");
    const depthBalancedBid = defined(depthSale.bids.find(bid => bid.owner === "Owner02"), "Expected owner bid.");
    expect(depthTopHeavyBid.buildStyleMultiplier).toBe(0.9);
    expect(depthTopHeavyBid.amount).toBeLessThan(depthBalancedBid.amount);
  });

  it("derives owner-specific roster maximums from backup-position history", async () => {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const maximums = buildOwnerRosterMaximums(buildOwnerProfiles(historicalRecords));

    expect(maximums.Owner01?.QB).toBe(2);
    expect(maximums.Owner08?.QB).toBe(1);
    expect(maximums.Owner06?.QB).toBe(2);
    expect(maximums.Owner04?.TE).toBe(1);
    expect(maximums.Owner03?.TE).toBeUndefined();
    expect(maximums.Owner02?.K).toBe(1);
    expect(maximums.Owner02?.DST).toBe(1);
    expect(maximums.Owner01?.DST).toBe(1);
  });

  it("applies owner-specific roster maximums during bidding", () => {
    const owners: Owner[] = ["Owner01", "Owner02"];
    const config = buildAuctionConfig({
      owners,
      auctionBudget: 100,
      rosterSize: 3,
      rosterMaximums: positionAmounts(3),
      starterMinimums: positionAmounts(0),
      flexMinimum: 0,
      ownerRosterMaximums: {
        Owner01: { QB: 1 },
      },
      seed: "owner-roster-maximums",
    });
    const ownerStates = createAuctionOwnerStates({
      config,
      initialRostersByOwner: {
        Owner01: [player("Owner01 starter QB", "QB", 20)],
      },
    });
    const sale = resolveAuctionSale(player("Backup QB", "QB", 10), ownerStates, [], config);

    expect(sale).toBeDefined();
    if (!sale) throw new Error("Expected sale to resolve.");

    expect(sale.bids.some(bid => bid.owner === "Owner01")).toBe(false);
    expect(sale.bids.some(bid => bid.owner === "Owner02")).toBe(true);
  });
});
