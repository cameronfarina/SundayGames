import { describe, expect, it } from "vitest";

import type {
  AuctionLeagueSeasonSettings,
  LeagueSeason,
  SnakeLeagueSeasonSettings,
} from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  parseSeasonSimulationStrategy,
  runSeasonSimulations,
  SeasonSimulationError,
} from "../src/platform/seasonSimulationEngine.js";

const teams = ["Cam", "Sam", "Matt", "Nick"].map((name, index) => ({
  id: `team-${index + 1}`,
  leagueSeasonId: "season-2026",
  ownerId: `owner-${index + 1}`,
  ownerDisplayName: name,
  displayName: `${name} Team`,
  draftOrderPosition: index + 1,
}));

const commonSeason = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" as const },
  seasonYear: 2026,
  setupStatus: "published" as const,
  teams,
};

const scoring = {
  passingYards: 0.04,
  passingTouchdown: 4,
  rushingYards: 0.1,
  rushingTouchdown: 6,
  receivingYards: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
};

const keeperPolicy = {
  mode: "previous-cost-multiplier" as const,
  multiplier: 1.2,
  rounding: "ceil" as const,
};

const auctionSeason: LeagueSeason<AuctionLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring,
    auction: { budgetDollars: 100, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};

const auctionSetup: LiveDraftRoomSetup = {
  seasonId: auctionSeason.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "De'Von Achane", position: "RB", expectedPrice: 30 },
    { name: "Jadarian Price", position: "RB", expectedPrice: 10 },
    { name: "Runner Two", position: "RB", expectedPrice: 22 },
    { name: "Runner Three", position: "RB", expectedPrice: 18 },
    { name: "Runner Four", position: "RB", expectedPrice: 14 },
    { name: "Runner Five", position: "RB", expectedPrice: 6 },
    { name: "Receiver One", position: "WR", expectedPrice: 20 },
    { name: "Receiver Two", position: "WR", expectedPrice: 16 },
    { name: "Receiver Three", position: "WR", expectedPrice: 12 },
    { name: "Receiver Four", position: "WR", expectedPrice: 8 },
    { name: "Receiver Five", position: "WR", expectedPrice: 4 },
  ],
  initialRosters: [{
    teamId: "team-1",
    playerId: "devon achane",
    playerName: "De'Von Achane",
    position: "RB",
    price: 30,
    source: "keeper",
  }],
  contentHash: "auction-hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

const snakeSeason: LeagueSeason<SnakeLeagueSeasonSettings> = {
  ...commonSeason,
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring,
    snake: {
      rounds: 2,
      order: teams.map(team => team.id),
      reversal: "standard",
    },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy,
  },
};

const snakeSetup: LiveDraftRoomSetup = {
  seasonId: snakeSeason.id,
  sourceVersion: "test",
  playerCatalog: [
    { name: "De'Von Achane", position: "RB", expectedPrice: 30 },
    { name: "Target Receiver", position: "WR", expectedPrice: 25 },
    { name: "Runner Two", position: "RB", expectedPrice: 20 },
    { name: "Runner Three", position: "RB", expectedPrice: 19 },
    { name: "Runner Four", position: "RB", expectedPrice: 18 },
    { name: "Receiver Two", position: "WR", expectedPrice: 17 },
    { name: "Receiver Three", position: "WR", expectedPrice: 16 },
    { name: "Receiver Four", position: "WR", expectedPrice: 15 },
  ],
  initialRosters: [{
    teamId: "team-1",
    playerId: "devon achane",
    playerName: "De'Von Achane",
    position: "RB",
    price: 0,
    keeperRound: 2,
    source: "keeper",
  }],
  contentHash: "snake-hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

describe("season simulation strategy parser", () => {
  it("reports only the auction target, preferred position, and pairing it can honor", () => {
    const strategy = parseSeasonSimulationStrategy(
      "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
    );

    expect(strategy).toEqual({
      rawInput: "Run 25 simulations where I draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      target: {
        playerName: "Jadarian Price",
        maxAuctionPrice: 20,
      },
      preferredPositions: [{ position: "RB", tier: "elite" }],
      pairWithPlayerName: "Achane",
      summary: "Target Jadarian Price up to $20; prioritize elite RB; pair with Achane.",
      warnings: [],
    });
  });

  it("parses snake deadlines and warns about strategy language it does not support", () => {
    expect(parseSeasonSimulationStrategy("Draft Ja'Marr Chase no later than round 3"))
      .toMatchObject({
        target: { playerName: "Ja'Marr Chase", maxSnakeRound: 3 },
        summary: "Target Ja'Marr Chase by round 3.",
        warnings: [],
      });
    expect(parseSeasonSimulationStrategy("Draft Puka Nacua by pick 18 and avoid week 6 byes"))
      .toMatchObject({
        target: { playerName: "Puka Nacua", maxSnakeOverallPick: 18 },
        warnings: ["Unsupported strategy phrase: \"avoid week 6 byes\"."],
      });
  });

  it("parses a named target without inventing a price or pick constraint", () => {
    expect(parseSeasonSimulationStrategy("Target CeeDee Lamb"))
      .toMatchObject({
        target: { playerName: "CeeDee Lamb" },
        summary: "Target CeeDee Lamb.",
        warnings: [],
      });
  });
});

describe("season simulation runner", () => {
  it("completes deterministic auction runs with keepers, a price-capped target, and exposure", () => {
    const input = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 3,
      strategyInput: "Draft Jadarian Price for no more than $20 and target an elite RB to pair with Achane",
      seedPrefix: "auction-plan",
    };

    const result = runSeasonSimulations(input);

    expect(result).toMatchObject({
      draftFormat: "auction",
      runCount: 3,
      completedCount: 3,
      seedPrefix: "auction-plan",
      targetOutcome: {
        playerName: "Jadarian Price",
        hitCount: 3,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 6, perRun: 2 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price"))
      .toMatchObject({ count: 3, rate: 1, averagePrice: expect.any(Number) });
    expect(result.playerExposure.find(player => player.playerName === "Jadarian Price")?.averagePrice)
      .toBeLessThanOrEqual(20);
    expect(result.strategy.warnings).not.toContain(
      "Pair-with player Achane was not found in the player catalog.",
    );
    expect(result.representativeRoster).toHaveLength(2);
    expect(result.representativeRoster[0]).toMatchObject({
      playerName: "De'Von Achane",
      source: "keeper",
    });
    expect(runSeasonSimulations(input)).toEqual(result);
  });

  it("completes deterministic snake runs with a round deadline and pick exposure", () => {
    const result = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 2,
      strategyInput: "Draft Target Receiver no later than round 2 to pair with De'Von Achane",
      seedPrefix: "snake-plan",
    });

    expect(result).toMatchObject({
      draftFormat: "snake",
      runCount: 2,
      completedCount: 2,
      targetOutcome: {
        playerName: "Target Receiver",
        hitCount: 2,
        hitRate: 1,
      },
      positionCounts: {
        RB: { total: 2, perRun: 1 },
        WR: { total: 2, perRun: 1 },
      },
    });
    expect(result.playerExposure.find(player => player.playerName === "Target Receiver"))
      .toMatchObject({ count: 2, rate: 1, averagePick: 1 });
    expect(result.representativeRoster).toEqual([
      expect.objectContaining({ playerName: "De'Von Achane", source: "keeper", round: 2 }),
      expect.objectContaining({ playerName: "Target Receiver", source: "human", overallPick: 1 }),
    ]);
  });

  it("returns typed boundary errors for invalid counts, claims, and setup configuration", () => {
    const baseInput = {
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      strategyInput: "",
    };

    for (const runCount of [0, 1.5, 26]) {
      expect(() => runSeasonSimulations({ ...baseInput, runCount }))
        .toThrow(new SeasonSimulationError(
          "invalid_run_count",
          "Simulation run count must be a whole number from 1 through 25.",
        ));
    }
    expect(() => runSeasonSimulations({ ...baseInput, humanTeamId: "missing", runCount: 1 }))
      .toThrowError(expect.objectContaining({ code: "human_team_missing" }));
    expect(() => runSeasonSimulations({
      ...baseInput,
      setup: { ...auctionSetup, seasonId: "another-season" },
      runCount: 1,
    })).toThrowError(expect.objectContaining({ code: "invalid_configuration" }));
  });

  it("warns when a parsed constraint belongs to the other draft format", () => {
    const auctionResult = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Jadarian Price by round 2",
    });
    const snakeResult = runSeasonSimulations({
      season: snakeSeason,
      setup: snakeSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Draft Target Receiver for no more than $12",
    });

    expect(auctionResult.strategy.warnings).toContain(
      "Round and pick deadlines do not apply to auction simulations; the player target was still prioritized.",
    );
    expect(snakeResult.strategy.warnings).toContain(
      "Auction price limits do not apply to snake simulations; the player target was still prioritized.",
    );
  });

  it("reports an unresolved target with a zero hit rate instead of pretending it was honored", () => {
    const result = runSeasonSimulations({
      season: auctionSeason,
      setup: auctionSetup,
      humanTeamId: "team-1",
      runCount: 1,
      strategyInput: "Target Missing Player",
    });

    expect(result.targetOutcome).toEqual({
      playerId: "missing player",
      playerName: "Missing Player",
      hitCount: 0,
      hitRate: 0,
    });
    expect(result.strategy.warnings).toContain(
      "Target player Missing Player was not found in the player catalog.",
    );
  });

  it("runs both formats for a valid twenty-team league", () => {
    const largeTeams = Array.from({ length: 20 }, (_, index) => ({
      id: `large-team-${index + 1}`,
      leagueSeasonId: "large-season",
      ownerId: `large-owner-${index + 1}`,
      ownerDisplayName: `Owner ${index + 1}`,
      displayName: `Large Team ${index + 1}`,
      draftOrderPosition: index + 1,
    }));
    const playerCatalog = Array.from({ length: 20 }, (_, index) => ({
      name: `Large Player ${index + 1}`,
      position: "RB" as const,
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
        snake: { rounds: 1, order: largeTeams.map(team => team.id), reversal: "standard" },
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
});
