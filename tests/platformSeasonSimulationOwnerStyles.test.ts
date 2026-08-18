import { describe, expect, it } from "vitest";

import type { HistoricalSaleRecord } from "../src/platform/historicalImports.js";
import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";

const teams = ["Human", "Avoider One", "Avoider Two", "Avoider Three"].map((name, index) => ({
  id: index === 0 ? "human" : `team-${index + 1}`,
  leagueSeasonId: "season-2026",
  ownerId: `owner-${index + 1}`,
  ownerDisplayName: name,
  displayName: name,
  draftOrderPosition: index + 1,
}));

const season: LeagueSeason<AuctionLeagueSeasonSettings> = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Styles", provider: "mockd" },
  seasonYear: 2026,
  setupStatus: "published",
  teams,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04, passingTouchdown: 4, rushingYards: 0.1,
      rushingTouchdown: 6, receivingYards: 0.1, receivingTouchdown: 6, reception: 0.5,
    },
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, BENCH: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 0, RB: 2, WR: 0, TE: 0, K: 0, DST: 0 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "Stud RB", position: "RB", expectedPrice: 60 },
    { name: "RB Two", position: "RB", expectedPrice: 12 },
    { name: "RB Three", position: "RB", expectedPrice: 10 },
    { name: "RB Four", position: "RB", expectedPrice: 9 },
    { name: "RB Five", position: "RB", expectedPrice: 8 },
    { name: "RB Six", position: "RB", expectedPrice: 7 },
    { name: "RB Seven", position: "RB", expectedPrice: 6 },
    { name: "RB Eight", position: "RB", expectedPrice: 5 },
  ],
  initialRosters: [],
  contentHash: "styles",
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
};

const avoiderSale = (
  ownerId: string,
  seasonYear: number,
): HistoricalSaleRecord => ({
  id: `sale-${ownerId}-${seasonYear}`,
  batchId: "batch-1",
  leagueId: "league-1",
  leagueSeasonId: "history-season",
  seasonYear,
  rowNumber: 1,
  ownerId,
  ownerDisplayName: ownerId,
  playerId: "history-player",
  playerName: "History Player",
  position: "RB",
  priceDollars: 5,
  keeper: false,
  acquisitionType: "auction",
});

describe("season simulations with owner drafting styles", () => {
  it("lets imported history pull stud prices under full value", () => {
    const result = runSeasonSimulations({
      season, setup, humanTeamId: "human", runCount: 1, seedPrefix: "styles",
      historicalSaleRecords: [2023, 2024, 2025].flatMap(year => [
        avoiderSale("owner-2", year),
        avoiderSale("owner-3", year),
        avoiderSale("owner-4", year),
      ]),
    });

    // Every AI owner historically refuses to pay up for studs, so the stud
    // clears near the best avoider bid instead of full value.
    const studPrice = result.runs[0]?.teams
      .flatMap(team => team.roster)
      .find(player => player.playerName === "Stud RB")?.price;
    expect(studPrice).toBeDefined();
    expect(studPrice ?? 0).toBeLessThanOrEqual(45);
  });
});
