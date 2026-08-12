import { describe, expect, it } from "vitest";
import type { LeagueSeason } from "../src/platform/leagueSeason.js";
import type { LiveDraftRoomSetup } from "../src/platform/liveDraftRoomSetups.js";
import {
  buildSeasonSnakeMockConfig,
  replaySeasonSnakeMockCommands,
  SeasonSnakeMockError,
} from "../src/platform/seasonSnakeMock.js";
import { applySnakeDraftCommand, createSnakeDraftState } from "../src/platform/snakeDraftEngine.js";

const season: LeagueSeason = {
  id: "season-2026",
  leagueId: "league-1",
  league: { id: "league-1", externalLeagueId: "1", name: "Sunday", provider: "espn" },
  seasonYear: 2026,
  setupStatus: "published",
  teams: ["Cam", "Sam", "Matt", "Nick"].map((name, index) => ({
    id: `team-${index + 1}`,
    leagueSeasonId: "season-2026",
    ownerId: `owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  })),
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    snake: { rounds: 2, order: ["team-1", "team-2", "team-3", "team-4"], reversal: "standard" },
    roster: {
      rosterSize: 2,
      lineup: { RB: 1, FLEX: 1 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy: { mode: "previous-cost-multiplier", multiplier: 1.2, rounding: "ceil" },
  },
};

const positions = ["RB", "WR", "TE", "QB", "RB", "WR", "TE", "QB"] as const;
const setup: LiveDraftRoomSetup = {
  seasonId: season.id,
  sourceVersion: "test",
  playerCatalog: positions.map((position, index) => ({
    name: `Player ${index + 1}`,
    position,
    expectedPrice: 50 - index,
    week1Projection: 20 - index,
  })),
  initialRosters: [{
    teamId: "team-2",
    playerId: "player 2",
    playerName: "Player 2",
    position: "WR",
    price: 0,
    keeperRound: 2,
    source: "keeper",
  }],
  contentHash: "hash",
  updatedAt: new Date("2026-08-11T12:00:00.000Z"),
};

describe("season snake mock adapter", () => {
  it("builds an arbitrary league config and places keepers in their owned round pick", () => {
    const config = buildSeasonSnakeMockConfig({
      season,
      setup,
      humanTeamId: "team-1",
      sessionId: "mock-1",
      seed: "seed-1",
    });

    expect(config.teamOrder).toEqual(["team-1", "team-2", "team-3", "team-4"]);
    expect(config.teams.map(team => team.name)).toEqual(["Cam Team", "Sam Team", "Matt Team", "Nick Team"]);
    expect(config.players[0]).toMatchObject({ id: "player 1", week1Projection: 20 });
    expect(config.keepers).toEqual([{ teamId: "team-2", playerId: "player 2", round: 2, pickInRound: 3 }]);
    const started = applySnakeDraftCommand(createSnakeDraftState(config), { type: "start", expectedRevision: 0 });
    expect(started.board.picks.find(pick => pick.round === 2 && pick.teamId === "team-2")?.selection)
      .toMatchObject({ playerId: "player 2", source: "keeper" });
  });

  it("replays persisted JSON commands and rejects malformed session data", () => {
    const config = buildSeasonSnakeMockConfig({ season, setup: { ...setup, initialRosters: [] }, humanTeamId: "team-1", sessionId: "mock-1", seed: "seed-1" });
    const started = replaySeasonSnakeMockCommands(config, [JSON.stringify({ type: "start", expectedRevision: 0 })]);
    expect(started.session.status).toBe("active");
    expect(started.session.currentPick?.teamId).toBe("team-1");

    expect(() => replaySeasonSnakeMockCommands(config, ["not-json"]))
      .toThrow(new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid."));
  });

  it("rejects auction seasons and unclaimed teams", () => {
    expect(() => buildSeasonSnakeMockConfig({
      season: { ...season, settings: { ...season.settings, draftFormat: "auction", snake: undefined, auction: { budgetDollars: 200, minimumBidDollars: 1 } } },
      setup,
      humanTeamId: "team-1",
      sessionId: "mock-1",
      seed: "seed-1",
    })).toThrow(new SeasonSnakeMockError("wrong_draft_format", "This mock session is not a snake draft."));

    expect(() => buildSeasonSnakeMockConfig({ season, setup, humanTeamId: "missing", sessionId: "mock-1", seed: "seed-1" }))
      .toThrow(new SeasonSnakeMockError("human_team_missing", "Claim a team before starting a snake mock draft."));
  });
});
