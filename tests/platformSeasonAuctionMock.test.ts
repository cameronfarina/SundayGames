import { describe, expect, it } from "vitest";
import type { Position } from "../config/league.js";
import type { ExplicitLeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
  SeasonAuctionMockError,
} from "../src/platform/seasonAuctionMock.js";

const season: ExplicitLeagueSeason = {
  id: "auction-season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" },
  seasonYear: 2026,
  setupStatus: "published",
  teams: ["Owner11", "Owner12", "Matt", "Nick"].map((name, index) => ({
    id: `team-${index + 1}`,
    leagueSeasonId: "auction-season-2026",
    ownerId: `owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  })),
  settings: {
    expectedTeamCount: 4,
    draftFormat: "auction",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    auction: { budgetDollars: 200, minimumBidDollars: 1 },
    roster: {
      rosterSize: 2,
      lineup: { BENCH: 2 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

const positions: readonly Position[] = ["RB", "WR", "TE", "QB", "RB", "WR", "TE", "QB"];

const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: positions.map((position, index) => ({
    name: `Player ${index + 1}`,
    position,
    expectedPrice: 50 - index,
    teamAbbreviation: index === 0 ? "DET" : undefined,
    byeWeek: index === 0 ? 8 : undefined,
    week1Projection: 20 - index,
  })),
  initialRosters: [{
    teamId: "team-2",
    playerId: "player 2",
    playerName: "Player 2",
    position: "WR",
    price: 25,
    source: "keeper",
  }],
  contentHash: "hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

describe("season auction mock adapter", () => {
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

    expect(config.teams.map(team => team.name)).toEqual(["Owner11 Team", "Owner12 Team", "Matt Team", "Nick Team"]);
    expect(config.budgetDollars).toBe(200);
    expect(config.rosterSlots).toEqual([{ slot: "BENCH", count: 2, eligiblePositions: ["QB", "RB", "WR", "TE", "K", "DST"] }]);
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

  it("caps specialist eligibility at 32 viable roles without promoting near-zero depth", () => {
    const specialistPositions: readonly Position[] = ["QB", "TE", "K", "DST"];
    const projectedRoleCount = 33;
    const viableRoleDepth = 32;
    const specialistSeason: ExplicitLeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        roster: {
          rosterSize: 6,
          lineup: { QB: 1, TE: 1, K: 1, DST: 1, BENCH: 2 },
          lineupSlotCount: 6,
          rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 2, DST: 2 },
        },
      },
    };
    const specialistSetup: LiveDraftRoomSetup = {
      ...setup,
      initialRosters: [],
      playerCatalog: [
        ...specialistPositions.flatMap(position => [
          ...Array.from({ length: projectedRoleCount }, (_, index) => ({
            name: `${position} Viable ${index + 1}`,
            position,
            expectedPrice: Math.max(1, projectedRoleCount - index),
            teamAbbreviation: `NFL${index + 1}`,
            week1Projection: 20 - index * 0.1,
            weeks1To4Projection: 80 - index * 0.1,
            seasonProjection: 300 - index,
          })),
          {
            name: `${position} Near-Zero Backup`,
            position,
            expectedPrice: 1,
            week1Projection: 0.1,
            weeks1To4Projection: 0.4,
            seasonProjection: 1.7,
          },
        ]),
        {
          name: "RB Bench Depth",
          position: "RB",
          expectedPrice: 1,
          week1Projection: 1,
        },
        {
          name: "WR Bench Depth",
          position: "WR",
          expectedPrice: 1,
          week1Projection: 1,
        },
      ],
    };

    const config = buildSeasonAuctionMockConfig({
      season: specialistSeason,
      setup: specialistSetup,
      humanTeamId: "team-1",
      sessionId: "specialist-mock",
      seed: "specialist-seed",
    });

    for (const position of specialistPositions) {
      const players = config.players.filter(player => player.position === position);
      expect(players.filter(player => player.projectedStarter).map(player => player.name))
        .toEqual(Array.from({ length: viableRoleDepth }, (_, index) => `${position} Viable ${index + 1}`));
      expect(players.filter(player => player.starterEligible).map(player => player.name))
        .toEqual(Array.from({ length: viableRoleDepth }, (_, index) => `${position} Viable ${index + 1}`));
      expect(players.find(player => player.name === `${position} Viable ${projectedRoleCount}`))
        .toMatchObject({ starterEligible: false });
      const placeholder = players.find(player => player.name === `${position} Near-Zero Backup`);
      expect(placeholder).toMatchObject({ starterEligible: false });
      expect(placeholder).not.toHaveProperty("projectedStarter");
    }
    expect(config.players.find(player => player.name === "RB Bench Depth"))
      .not.toHaveProperty("starterEligible");
    expect(config.players.find(player => player.name === "WR Bench Depth"))
      .not.toHaveProperty("starterEligible");
  });

  it("rejects unknown legacy roster slots", () => {
    const unsupportedSeason: ExplicitLeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        roster: {
          ...season.settings.roster,
          lineup: { MYSTERY: 2 },
        },
      },
    };

    expect(() => buildSeasonAuctionMockConfig({
      season: unsupportedSeason,
      setup,
      humanTeamId: "team-1",
      sessionId: "unsupported-mock",
      seed: "unsupported-seed",
    })).toThrow(new SeasonAuctionMockError(
      "setup_mismatch",
      "Roster slot MYSTERY is unsupported. Review the league roster settings before starting a mock.",
    ));
  });

  it("replays persisted JSON commands and rejects malformed data", () => {
    const config = buildSeasonAuctionMockConfig({
      season,
      setup: { ...setup, initialRosters: [] },
      humanTeamId: "team-1",
      sessionId: "mock-1",
      seed: "seed-1",
    });
    const state = replaySeasonAuctionMockCommands(config, [
      JSON.stringify({ type: "start", expectedRevision: 0 }),
    ]);
    expect(state.session.status).toBe("active");

    expect(() => replaySeasonAuctionMockCommands(config, ["bad-json"]))
      .toThrow(new SeasonAuctionMockError("invalid_command_log", "Auction mock command log is invalid."));
  });

  it("rejects snake seasons and unclaimed teams", () => {
    const snakeSettings: ExplicitLeagueSeason["settings"] = {
      expectedTeamCount: season.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: season.settings.scoring,
      snake: { rounds: 2, order: season.teams.map(team => team.id), reversal: "standard" },
      roster: season.settings.roster,
      keeperPolicy: season.settings.keeperPolicy,
    };
    expect(() => buildSeasonAuctionMockConfig({
      season: { ...season, settings: snakeSettings },
      setup,
      humanTeamId: "team-1",
      sessionId: "mock-1",
      seed: "seed-1",
    })).toThrow(new SeasonAuctionMockError("wrong_draft_format", "This mock session is not an auction draft."));

    expect(() => buildSeasonAuctionMockConfig({ season, setup, humanTeamId: "missing", sessionId: "mock-1", seed: "seed-1" }))
      .toThrow(new SeasonAuctionMockError("human_team_missing", "Claim a team before starting an auction mock draft."));
  });
});
