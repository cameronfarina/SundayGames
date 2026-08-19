import { describe, expect, it } from "vitest";
import { leagueInflationFor } from "../src/platform/pricingRebuild/leagueInflation.js";
import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";

const baselinePrices = [
  { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 60 },
  { name: "Bravo Receiver", normalizedName: "bravo receiver", position: "WR", price: 40 },
  { name: "Charlie Kicker", normalizedName: "charlie kicker", position: "K", price: 1 },
] satisfies readonly PricingSourcePrice[];

const saleWithoutPublicPrice = (
  overrides: Partial<HistoricalSaleRecord> = {},
): HistoricalSaleRecord => {
  const record = sale(overrides);
  delete record.publicPriceDollars;

  return record;
};

const sale = (overrides: Partial<HistoricalSaleRecord> = {}): HistoricalSaleRecord => ({
  id: "sale-1",
  batchId: "batch-2025",
  leagueId: "league-100001",
  leagueSeasonId: "league-season-2025",
  seasonYear: 2025,
  rowNumber: 4,
  ownerId: "owner-1",
  ownerDisplayName: "Owner One",
  playerId: "player-alpha",
  playerName: "Alpha Runner",
  position: "RB",
  priceDollars: 70,
  publicPriceDollars: 50,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

const input = (overrides: Record<string, unknown> = {}) => ({
  leagueId: "league-100001",
  seasonYear: 2026,
  modelVersion: "flat-inflation-v1",
  scenarioIds: ["expected"],
  baselinePrices,
  historicalSaleRecords: [],
  currentTeamCount: 14,
  currentAuctionBudget: 200,
  currentRosterSize: 16,
  currentMinimumBidDollars: 1,
  ...overrides,
});

describe("league inflation multiplier", () => {
  it("divides total league dollars by total public dollars", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "b", priceDollars: 30, publicPriceDollars: 20 }),
      ],
    }));

    expect(result).toMatchObject({
      source: "history",
      leagueDollars: 100,
      publicDollars: 70,
      countedSaleCount: 2,
      multiplier: 1.43,
    });
  });

  it("counts one dollar-weighted number rather than an average of per-player ratios", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 80, publicPriceDollars: 57 }),
        sale({ id: "b", priceDollars: 4, publicPriceDollars: 1 }),
      ],
    }));

    expect(result.multiplier).toBe(1.45);
  });

  it("ignores sales below the counted minimum", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "b", priceDollars: 2, publicPriceDollars: 1 }),
      ],
    }));

    expect(result).toMatchObject({ countedSaleCount: 1, multiplier: 1.4 });
  });

  it("counts a sale at the minimum", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 3, publicPriceDollars: 2 }),
      ],
    }));

    expect(result).toMatchObject({ countedSaleCount: 1, multiplier: 1.5 });
  });

  it("ignores kickers and defenses", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "k", position: "K", priceDollars: 6, publicPriceDollars: 1 }),
        sale({ id: "d", position: "DST", priceDollars: 5, publicPriceDollars: 1 }),
      ],
    }));

    expect(result).toMatchObject({ countedSaleCount: 1, multiplier: 1.4 });
  });

  it("ignores keepers, other leagues, later seasons and non-auction rows", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "keeper", keeper: true, priceDollars: 90, publicPriceDollars: 10 }),
        sale({ id: "other", leagueId: "league-999", priceDollars: 90, publicPriceDollars: 10 }),
        sale({ id: "future", seasonYear: 2027, priceDollars: 90, publicPriceDollars: 10 }),
        sale({ id: "kept", acquisitionType: "keeper", priceDollars: 90, publicPriceDollars: 10 }),
      ],
    }));

    expect(result).toMatchObject({ countedSaleCount: 1, multiplier: 1.4 });
  });

  it("uses every imported season rather than only the most recent ones", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [
        sale({ id: "a", seasonYear: 2025, priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "b", seasonYear: 2024, priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "c", seasonYear: 2023, priceDollars: 70, publicPriceDollars: 50 }),
        sale({ id: "d", seasonYear: 2022, priceDollars: 30, publicPriceDollars: 50 }),
      ],
    }));

    expect(result.countedSaleCount).toBe(4);
    expect(result.multiplier).toBe(1.2);
  });

  it("falls back to league money divided by the public board when no sale carries a public value", () => {
    const result = leagueInflationFor(input({
      historicalSaleRecords: [saleWithoutPublicPrice()],
      currentTeamCount: 3,
      currentRosterSize: 1,
      currentAuctionBudget: 100,
    }));

    expect(result).toMatchObject({
      source: "budget",
      leagueDollars: 300,
      publicDollars: 100,
      countedSaleCount: 0,
      multiplier: 3,
    });
  });

  it("uses a commissioner's own inflation number when no sale has been imported", () => {
    const result = leagueInflationFor(input({ manualInflationMultiplier: 1.2 }));

    expect(result).toMatchObject({
      source: "manual",
      multiplier: 1.2,
      countedSaleCount: 0,
      leagueDollars: 0,
      publicDollars: 0,
    });
  });

  it("prefers imported sales over a commissioner's own inflation number", () => {
    const result = leagueInflationFor(input({
      manualInflationMultiplier: 1.2,
      historicalSaleRecords: [sale({ id: "a", priceDollars: 70, publicPriceDollars: 50 })],
    }));

    expect(result).toMatchObject({ source: "history", multiplier: 1.4 });
  });

  it("uses a commissioner's own number when imported sales carry no public value", () => {
    const result = leagueInflationFor(input({
      manualInflationMultiplier: 1.2,
      historicalSaleRecords: [saleWithoutPublicPrice()],
    }));

    expect(result).toMatchObject({ source: "manual", multiplier: 1.2 });
  });

  it("prefers a commissioner's own number over the league money fallback", () => {
    const result = leagueInflationFor(input({
      manualInflationMultiplier: 1.2,
      currentTeamCount: 3,
      currentRosterSize: 1,
      currentAuctionBudget: 100,
    }));

    expect(result).toMatchObject({ source: "manual", multiplier: 1.2 });
  });

  it("rounds a commissioner's own number to two decimal places", () => {
    const result = leagueInflationFor(input({ manualInflationMultiplier: 1.23456 }));

    expect(result.multiplier).toBe(1.23);
  });

  it("ignores an inflation number outside the range a league could pay", () => {
    for (const manualInflationMultiplier of [0, -1, 12, Number.NaN]) {
      const result = leagueInflationFor(input({
        manualInflationMultiplier,
        currentTeamCount: 3,
        currentRosterSize: 1,
        currentAuctionBudget: 100,
      }));

      expect(result.source).toBe("budget");
    }
  });

  it("leaves prices alone when neither history nor league money is known", () => {
    const result = leagueInflationFor(input({
      currentTeamCount: undefined,
      currentAuctionBudget: undefined,
    }));

    expect(result).toMatchObject({ source: "unavailable", multiplier: 1 });
  });

  it("leaves prices alone when the board cannot fill the league's roster slots", () => {
    const result = leagueInflationFor(input({
      currentTeamCount: 2,
      currentRosterSize: 2,
    }));

    expect(result).toMatchObject({ source: "unavailable", multiplier: 1 });
  });

  it("leaves prices alone when the public board is worthless", () => {
    const result = leagueInflationFor(input({
      baselinePrices: [
        { name: "Charlie Kicker", normalizedName: "charlie kicker", position: "K", price: 1 },
      ],
    }));

    expect(result).toMatchObject({ source: "unavailable", multiplier: 1 });
  });
});
