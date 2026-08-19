import { expect, it } from "vitest";
import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
  SnakeLeagueSeasonSettings,
} from "../../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../src/platform/liveDraftRoomSetups.js";
import { runSeasonSimulations } from "../../src/platform/seasonSimulationEngine.js";
import { commonSeason, keeperPolicy, scoring } from "./leagueFixtures.js";
import { catalogPlayer } from "./simulationFixtures.js";

export const registerLargeLeagueTests = (): void => {
  it("runs both formats for a valid twenty-team league", () => {
    const largeTeams = Array.from({ length: 20 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "large-season",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Large Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const playerCatalog = Array.from({ length: 20 }, (_, index) => catalogPlayer({
      name: `Large Player ${index + 1}`,
      position: "RB",
      expectedPrice: 20 - Math.floor(index / 2),
    }));
    const roster = {
      rosterSize: 1,
      lineup: { RB: 1 },
      lineupSlotCount: 1,
      rosterMaximums: { QB: 1, RB: 1, WR: 1, TE: 1, K: 1, DST: 1 },
    };
    const largeSetup: LiveDraftRoomSetup = {
      seasonId: "large-season",
      sourceVersion: "test",
      playerCatalog,
      initialRosters: [],
      contentHash: "large-hash",
      updatedAt: new Date("2026-08-11T12:00:00.000Z"),
    };
    const largeAuctionSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
      ...commonSeason,
      id: "large-season",
      teams: largeTeams,
      settings: {
        expectedTeamCount: 20,
        draftFormat: "auction",
        scoring,
        auction: { budgetDollars: 100, minimumBidDollars: 1 },
        roster,
        keeperPolicy,
      },
    };
    const largeSnakeSeason: LeagueSeason<SnakeLeagueSeasonSettings> = {
      ...largeAuctionSeason,
      settings: {
        expectedTeamCount: 20,
        draftFormat: "snake",
        scoring,
        snake: { rounds: 1, order: largeTeams.map(team => team.id) },
        roster,
        keeperPolicy,
      },
    };

    expect(runSeasonSimulations({
      season: largeAuctionSeason,
      setup: largeSetup,
      humanTeamId: "large-team-20",
      runCount: 1,
    }).completedCount).toBe(1);
    expect(runSeasonSimulations({
      season: largeSnakeSeason,
      setup: largeSetup,
      humanTeamId: "large-team-20",
      runCount: 1,
    }).completedCount).toBe(1);
  });
};
