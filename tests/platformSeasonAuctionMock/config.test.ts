import { describe, expect, it } from "vitest";
import type { ExplicitLeagueSeason } from "../../src/platform/leagueSeason.js";
import { buildSeasonAuctionMockConfig } from "../../src/platform/seasonAuctionMock.js";
import { season, setup } from "./fixtures.js";

describe("season auction mock configuration", () => {
  it("builds arbitrary league teams, roster limits, keepers, and personalized prices", () => {
    const config = buildSeasonAuctionMockConfig({
      season,
      setup,
      humanTeamId: "team-1",
      sessionId: "mock-1",
      seed: "seed-1",
      playerExpectedPrices: { "player 1": 64 },
      playerHumanValues: { "player 1": 71 },
    });
    expect(config.teams.map(team => team.name))
      .toEqual(["Owner11 Team", "Owner12 Team", "Matt Team", "Nick Team"]);
    expect(config.budgetDollars).toBe(200);
    expect(config.rosterSlots).toEqual([{
      slot: "BENCH",
      count: 2,
      eligiblePositions: ["QB", "RB", "WR", "TE", "K", "DST"],
    }]);
    expect(config.keepers).toEqual([{ teamId: "team-2", playerId: "player 2", price: 25 }]);
    expect(config.players[0]).toMatchObject({
      id: "player 1",
      expectedPrice: 64,
      humanValue: 71,
      teamAbbreviation: "DET",
      byeWeek: 8,
      week1Projection: 20,
    });
  });

  it("uses canonical hybrid eligibility and excludes IR from mock capacity", () => {
    const hybridSeason: ExplicitLeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        roster: {
          rosterSize: 8,
          lineup: { QB: 1, OP: 1, RB_WR: 1, WR_TE: 1, FLEX: 1, BENCH: 1, IR: 2 },
          lineupSlotCount: 8,
          rosterMaximums: { QB: 8, RB: 8, WR: 8, TE: 8, K: 8, DST: 8 },
        },
      },
    };
    const config = buildSeasonAuctionMockConfig({
      season: hybridSeason,
      setup: { ...setup, initialRosters: [] },
      humanTeamId: "team-1",
      sessionId: "hybrid-mock",
      seed: "hybrid-seed",
    });
    expect(config.rosterSlots).toEqual([
      { slot: "QB", count: 1, eligiblePositions: ["QB"] },
      { slot: "OP", count: 1, eligiblePositions: ["QB", "RB", "WR", "TE"] },
      { slot: "RB_WR", count: 1, eligiblePositions: ["RB", "WR"] },
      { slot: "WR_TE", count: 1, eligiblePositions: ["WR", "TE"] },
      { slot: "FLEX", count: 1, eligiblePositions: ["RB", "WR", "TE"] },
      { slot: "BENCH", count: 1, eligiblePositions: ["QB", "RB", "WR", "TE", "K", "DST"] },
    ]);
    expect(config.positionMaximums).toEqual({ QB: 3, RB: 4, WR: 5, TE: 4, K: 1, DST: 1 });
  });
});
