import { describe, expect, it } from "vitest";
import type { ExplicitLeagueSeason } from "../../src/platform/leagueSeason.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
  SeasonAuctionMockError,
} from "../../src/platform/seasonAuctionMock.js";
import { season, setup } from "./fixtures.js";

describe("season auction mock errors", () => {
  it("rejects unknown legacy roster slots", () => {
    const unsupportedSeason: ExplicitLeagueSeason = {
      ...season,
      settings: {
        ...season.settings,
        roster: { ...season.settings.roster, lineup: { MYSTERY: 2 } },
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
      .toThrow(new SeasonAuctionMockError(
        "invalid_command_log",
        "Auction mock command log is invalid.",
      ));
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
    })).toThrow(new SeasonAuctionMockError(
      "wrong_draft_format",
      "This mock session is not an auction draft.",
    ));
    expect(() => buildSeasonAuctionMockConfig({
      season,
      setup,
      humanTeamId: "missing",
      sessionId: "mock-1",
      seed: "seed-1",
    })).toThrow(new SeasonAuctionMockError(
      "human_team_missing",
      "Claim a team before starting an auction mock draft.",
    ));
  });
});
