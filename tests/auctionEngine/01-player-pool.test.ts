import { describe, expect, it } from "vitest";
import { buildAuctionPlayerPool } from "../../src/modeling/auctionEngine.js";
import { projection } from "./support.js";

describe("auction engine economics", () => {
  it("uses a descending price ladder for replacement-pool players before falling back to $1", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [
        {
          id: 1,
          name: "Priced RB",
          position: "RB",
          price: 12,
          weeks1To4: 50,
        },
      ],
      projections: [
        projection(1, "Priced RB", "RB", 50),
        projection(2, "Replacement 1", "RB", 49),
        projection(3, "Replacement 2", "WR", 48),
        projection(4, "Replacement 3", "RB", 47),
        projection(5, "Replacement 4", "WR", 46),
        projection(6, "Replacement 5", "TE", 45),
        projection(7, "Replacement 6", "RB", 44),
      ],
      targetCount: 7,
      replacementPriceLadder: [
        { count: 2, price: 6 },
        { count: 2, price: 3 },
      ],
      replacementPrice: 1,
    });

    const replacementPrices = pool
      .filter(poolPlayer => poolPlayer.name.startsWith("Replacement"))
      .sort((left, right) => right.price - left.price || right.weeks1To4 - left.weeks1To4)
      .map(poolPlayer => poolPlayer.price);

    expect(replacementPrices).toEqual([6, 6, 3, 3, 1, 1]);
  });

  it("defaults replacement-pool players to one-dollar fallback prices", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [],
      projections: [
        projection(1, "Replacement RB", "RB", 80),
        projection(2, "Replacement WR", "WR", 70),
        projection(3, "Replacement TE", "TE", 60),
      ],
      targetCount: 3,
    });

    expect(pool.map(poolPlayer => poolPlayer.price)).toEqual([1, 1, 1]);
  });

  it("carries full-season projections through priced and replacement auction players", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [
        {
          id: 1,
          name: "Priced RB",
          position: "RB",
          price: 12,
          weeks1To4: 50,
          seasonProjection: 260,
        },
      ],
      projections: [
        projection(1, "Priced RB", "RB", 50, 260),
        projection(2, "Replacement 1", "RB", 49, 280),
      ],
      targetCount: 2,
    });

    expect(pool.find(poolPlayer => poolPlayer.name === "Priced RB")?.seasonProjection).toBe(260);
    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement 1")?.seasonProjection).toBe(280);
  });

  it("keeps replacement kickers and defenses at the fallback price", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [],
      projections: [
        projection(1, "Replacement K", "K", 80),
        projection(2, "Replacement RB", "RB", 70),
        projection(3, "Replacement DST", "DST", 60),
      ],
      targetCount: 3,
      replacementPriceLadder: [{ count: 3, price: 6 }],
      replacementPrice: 1,
    });

    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement RB")?.price).toBe(6);
    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement K")?.price).toBe(1);
    expect(pool.find(poolPlayer => poolPlayer.name === "Replacement DST")?.price).toBe(1);
  });

  it("carries context adjustment metadata from priced players into the auction pool", () => {
    const pool = buildAuctionPlayerPool({
      pricedPlayers: [
        {
          id: 1,
          name: "Context WR",
          position: "WR",
          price: 50,
          scenarioPrice: 52,
          weeks1To4: 80,
          contextAdjustmentPercent: -0.105,
          contextEvidence: [
            { category: "risk" },
            { category: "environment" },
          ],
        },
      ],
      projections: [],
      targetCount: 1,
    });

    expect(pool[0]).toMatchObject({
      name: "Context WR",
      price: 52,
      contextAdjustmentPercent: -0.105,
      contextEvidenceCount: 2,
    });
  });
});
