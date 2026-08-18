import { describe, expect, it } from "vitest";
import type { HistoricalSaleRecord } from "../../src/platform/historicalImports.js";
import { buildSeasonAuctionMockConfig } from "../../src/platform/seasonAuctionMock.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { season, setup } from "./fixtures.js";

const sale = (overrides: Partial<HistoricalSaleRecord>): HistoricalSaleRecord => ({
  id: `sale-${overrides.ownerId}-${overrides.seasonYear}-${overrides.priceDollars}`,
  batchId: "batch-1",
  leagueId: "league-1",
  leagueSeasonId: "history-season",
  seasonYear: 2023,
  rowNumber: 1,
  ownerId: "owner-1",
  ownerDisplayName: "Owner",
  playerId: "history-player",
  playerName: "History Player",
  position: "RB",
  priceDollars: 10,
  keeper: false,
  acquisitionType: "auction",
  ...overrides,
});

// Board: unkept values 100, 50, 44, 42, ... so the top-4 median (the price of
// a typical available stud) is (50 + 44) / 2 = 47. Player 2 (60) is kept and
// must not count as an available stud.
const styleSetup: LiveDraftRoomSetup = {
  ...setup,
  playerCatalog: [
    { name: "Player 1", position: "RB", expectedPrice: 100 },
    { name: "Player 2", position: "WR", expectedPrice: 60 },
    { name: "Player 3", position: "TE", expectedPrice: 50 },
    { name: "Player 4", position: "QB", expectedPrice: 44 },
    { name: "Player 5", position: "RB", expectedPrice: 42 },
    { name: "Player 6", position: "WR", expectedPrice: 10 },
    { name: "Player 7", position: "TE", expectedPrice: 8 },
    { name: "Player 8", position: "QB", expectedPrice: 6 },
  ],
};

const build = (historicalSaleRecords: readonly HistoricalSaleRecord[]) =>
  buildSeasonAuctionMockConfig({
    season,
    setup: styleSetup,
    humanTeamId: "team-1",
    sessionId: "styles-1",
    seed: "styles-seed",
    historicalSaleRecords,
  });

const tendencyFor = (
  config: ReturnType<typeof build>,
  teamId: string,
) => config.teams.find(team => team.id === teamId)?.aiTendency;

describe("owner drafting styles from league history", () => {
  it("derives each owner's premium bid multiplier from their median yearly top buy", () => {
    const config = build([
      // owner-1: yearly tops 60, 40, 50 -> median 50 -> 50 / 47.
      sale({ ownerId: "owner-1", seasonYear: 2023, priceDollars: 60 }),
      sale({ ownerId: "owner-1", seasonYear: 2023, priceDollars: 20 }),
      sale({ ownerId: "owner-1", seasonYear: 2024, priceDollars: 40 }),
      sale({ ownerId: "owner-1", seasonYear: 2025, priceDollars: 50 }),
      // Keeper rows and other leagues' sales never count.
      sale({ ownerId: "owner-1", seasonYear: 2024, priceDollars: 70, keeper: true, acquisitionType: "keeper" }),
      sale({ ownerId: "owner-1", seasonYear: 2024, priceDollars: 99, leagueId: "league-2" }),
      // owner-2: yearly tops 30, 36 -> even-count median 33 -> 33 / 47.
      sale({ ownerId: "owner-2", seasonYear: 2024, priceDollars: 30 }),
      sale({ ownerId: "owner-2", seasonYear: 2025, priceDollars: 36 }),
      // owner-3: keeper rows only, so no auction history.
      sale({ ownerId: "owner-3", seasonYear: 2024, priceDollars: 55, keeper: true, acquisitionType: "keeper" }),
      // owner-4: top 90 -> 90 / 47 caps at 1.3.
      sale({ ownerId: "owner-4", seasonYear: 2023, priceDollars: 90 }),
    ]);

    expect(tendencyFor(config, "team-1")?.premiumBidMultiplier).toBeCloseTo(50 / 47, 5);
    expect(tendencyFor(config, "team-2")?.premiumBidMultiplier).toBeCloseTo(33 / 47, 5);
    expect(tendencyFor(config, "team-3")).toBeUndefined();
    expect(tendencyFor(config, "team-4")?.premiumBidMultiplier).toBe(1.3);
  });

  it("clamps an extreme stud-avoider to the floor multiplier", () => {
    const config = build([
      sale({ ownerId: "owner-2", seasonYear: 2024, priceDollars: 5 }),
    ]);

    expect(tendencyFor(config, "team-2")?.premiumBidMultiplier).toBe(0.4);
  });

  it("leaves every team untouched without history", () => {
    const config = build([]);

    expect(config.teams.every(team => team.aiTendency === undefined)).toBe(true);
  });
});
