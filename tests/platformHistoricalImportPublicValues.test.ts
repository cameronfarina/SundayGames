import { describe, expect, it } from "vitest";
import type { Position } from "../config/league.js";
import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import { parseHistoricalImportSource } from "../src/platform/historicalImportSource.js";
import { leagueInflationFor } from "../src/platform/pricingRebuild/leagueInflation.js";
import type { PricingSourcePrice } from "../src/platform/pricingSnapshots.js";

const baselinePrices = [
  { name: "Alpha Runner", normalizedName: "alpha runner", position: "RB", price: 60 },
] satisfies readonly PricingSourcePrice[];

const saleFromRow = (
  row: { position?: string; priceDollars?: number; publicPriceDollars?: number },
  index: number,
): HistoricalSaleRecord => ({
  id: `sale-${String(index)}`,
  batchId: "batch-2025",
  leagueId: "league-100001",
  leagueSeasonId: "league-season-2025",
  seasonYear: 2025,
  rowNumber: index + 1,
  ownerId: "owner-1",
  ownerDisplayName: "Owner One",
  playerId: `player-${String(index)}`,
  playerName: `Player ${String(index)}`,
  position: (row.position ?? "RB") as Position,
  priceDollars: row.priceDollars ?? 0,
  ...(row.publicPriceDollars === undefined
    ? {}
    : { publicPriceDollars: row.publicPriceDollars }),
  keeper: false,
  acquisitionType: "auction",
});

const inflationFromSource = (sourceText: string) => leagueInflationFor({
  leagueId: "league-100001",
  seasonYear: 2026,
  modelVersion: "league-flat-inflation-v2",
  scenarioIds: ["balanced"],
  baselinePrices,
  historicalSaleRecords: parseHistoricalImportSource(sourceText).rows.map(saleFromRow),
  currentTeamCount: 14,
  currentAuctionBudget: 200,
  currentRosterSize: 16,
  currentMinimumBidDollars: 1,
});

describe("wide auction sheets and the league inflation multiplier", () => {
  // Jahmyr Gibbs is RB1 on the 2026 ESPN board at $57 and Ja'Marr Chase is WR1
  // at $56, so a sheet that pays $80 and $70 for them is a league that pays
  // above published market prices.
  const wideSheet = [
    "Team,Owner11,,,Owner12,,",
    "1,$80,RB,Jahmyr Gibbs,$70,WR,Ja'Marr Chase",
  ].join("\n");

  it("prices a wide sheet from league history rather than the budget fallback", () => {
    const result = inflationFromSource(wideSheet);

    expect(result.source).toBe("history");
    expect(result.countedSaleCount).toBe(2);
    expect(result.multiplier).toBe(1.33);
  });

  it("reads a published value for every wide-sheet player on the public board", () => {
    const rows = parseHistoricalImportSource(wideSheet).rows;

    expect(rows.map(row => row.publicPriceDollars)).toEqual([57, 56]);
  });

  it("leaves a wide-sheet player who is not on the public board without one", () => {
    const rows = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "1,$40,RB,Nobody Retired,$70,WR,Ja'Marr Chase",
    ].join("\n")).rows;

    expect(rows[0]).not.toHaveProperty("publicPriceDollars");
    expect(rows[1]?.publicPriceDollars).toBe(56);
  });

  it("ignores a public board entry that plays a different position", () => {
    const rows = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "1,$40,WR,Jahmyr Gibbs,$70,WR,Ja'Marr Chase",
    ].join("\n")).rows;

    expect(rows[0]).not.toHaveProperty("publicPriceDollars");
  });

  it("leaves a kicker or defense without a published value", () => {
    const rows = parseHistoricalImportSource([
      "Team,Owner11,,,Owner12,,",
      "1,$3,K,Brandon Aubrey,$2,K,Cameron Dicker",
    ].join("\n")).rows;

    expect(rows[0]).not.toHaveProperty("publicPriceDollars");
    expect(rows[1]).not.toHaveProperty("publicPriceDollars");
  });
});
