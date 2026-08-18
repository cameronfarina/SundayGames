import { describe, expect, it } from "vitest";

import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";

const teams = ["Human", "Owner Two", "Owner Three", "Owner Four"].map((name, index) => ({
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
  league: { id: "league-1", externalLeagueId: "1", name: "Spend", provider: "mockd" },
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
    auction: { budgetDollars: 100, minimumBidDollars: 1 },
    roster: {
      rosterSize: 5,
      lineup: { RB: 2, WR: 2, BENCH: 1 },
      lineupSlotCount: 5,
      rosterMaximums: { QB: 0, RB: 4, WR: 4, TE: 0, K: 0, DST: 0 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

// The room holds 4 x $100 = $400 against a $340 sub-stud board, so
// spend-down pressure does the clearing work. Real owners spend it all:
// history shows 37 of 42 owner-years leave exactly $0, max $3.
const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "RB One", position: "RB", expectedPrice: 38 },
    { name: "RB Two", position: "RB", expectedPrice: 30 },
    { name: "RB Three", position: "RB", expectedPrice: 22 },
    { name: "RB Four", position: "RB", expectedPrice: 14 },
    { name: "RB Five", position: "RB", expectedPrice: 12 },
    { name: "RB Six", position: "RB", expectedPrice: 10 },
    { name: "RB Seven", position: "RB", expectedPrice: 8 },
    { name: "RB Eight", position: "RB", expectedPrice: 6 },
    { name: "RB Nine", position: "RB", expectedPrice: 5 },
    { name: "RB Ten", position: "RB", expectedPrice: 4 },
    { name: "RB Eleven", position: "RB", expectedPrice: 3 },
    { name: "RB Twelve", position: "RB", expectedPrice: 2 },
    { name: "RB Thirteen", position: "RB", expectedPrice: 1 },
    { name: "RB Fourteen", position: "RB", expectedPrice: 1 },
    { name: "WR One", position: "WR", expectedPrice: 35 },
    { name: "WR Two", position: "WR", expectedPrice: 28 },
    { name: "WR Three", position: "WR", expectedPrice: 20 },
    { name: "WR Four", position: "WR", expectedPrice: 15 },
    { name: "WR Five", position: "WR", expectedPrice: 12 },
    { name: "WR Six", position: "WR", expectedPrice: 9 },
    { name: "WR Seven", position: "WR", expectedPrice: 7 },
    { name: "WR Eight", position: "WR", expectedPrice: 5 },
    { name: "WR Nine", position: "WR", expectedPrice: 4 },
    { name: "WR Ten", position: "WR", expectedPrice: 3 },
    { name: "WR Eleven", position: "WR", expectedPrice: 2 },
    { name: "WR Twelve", position: "WR", expectedPrice: 2 },
    { name: "WR Thirteen", position: "WR", expectedPrice: 1 },
    { name: "WR Fourteen", position: "WR", expectedPrice: 1 },
  ],
  initialRosters: [],
  contentHash: "spend-down",
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
};

describe("auction spend-down", () => {
  it("leaves every team at exactly zero budget, the way real owners finish", () => {
    const result = runSeasonSimulations({
      season, setup, humanTeamId: "human", runCount: 1, seedPrefix: "spend-down",
    });

    const leftovers = (result.runs[0]?.teams ?? [])
      .map(team => ({
        name: team.teamName,
        leftover: 100 - team.roster.reduce((total, player) => total + (player.price ?? 0), 0),
      }));

    // Every owner spends the full budget. Not close to full: full.
    expect(leftovers).toHaveLength(4);
    for (const team of leftovers) {
      expect(team.leftover, `${team.name} leftover`).toBe(0);
    }
  });
});
