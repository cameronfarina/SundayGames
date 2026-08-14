import { describe, expect, it } from "vitest";
import { leagueConfig } from "../config/league.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import {
  assertLeagueCreationAllowed,
  defaultLeagueCreationLimits,
  LeagueCreationLimitError,
  leagueSeasonSetupRevision,
  membershipKeyFor,
  normalizeLeagueCreationLimits,
} from "../src/platform/leagueSetup.js";

describe("league setup policies", () => {
  it("normalizes the default creation limits", () => {
    expect(normalizeLeagueCreationLimits()).toEqual(defaultLeagueCreationLimits);
  });

  it.each([
    { maxActiveLeaguesPerAccount: 0, maxCreatedLeaguesPerWindow: 1, creationWindowMs: 1 },
    { maxActiveLeaguesPerAccount: 1, maxCreatedLeaguesPerWindow: 1.5, creationWindowMs: 1 },
    { maxActiveLeaguesPerAccount: 1, maxCreatedLeaguesPerWindow: 1, creationWindowMs: -1 },
  ])("rejects invalid creation limits", limits => {
    expect(() => normalizeLeagueCreationLimits(limits)).toThrow("must be a positive integer");
  });

  it("uses the oldest recent creation to calculate a retry delay", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const records = [
      { leagueId: "later", createdByUserId: "user", createdAt: new Date(now.getTime() - 10_000) },
      { leagueId: "other", createdByUserId: "other", createdAt: now },
      { leagueId: "earlier", createdByUserId: "user", createdAt: new Date(now.getTime() - 20_000) },
    ];

    expect(() => assertLeagueCreationAllowed({
      records,
      createdByUserId: "user",
      now,
      limits: {
        maxActiveLeaguesPerAccount: 10,
        maxCreatedLeaguesPerWindow: 2,
        creationWindowMs: 60_000,
      },
    })).toThrow(new LeagueCreationLimitError(
      "league_creation_rate_limited",
      "Too many leagues were created recently. Try again later.",
      40,
    ));
  });

  it("builds collision-free membership keys", () => {
    expect(membershipKeyFor("user", "league")).toBe("user\0league");
  });

  it("revisions seasons with optional team metadata omitted", () => {
    const season = buildCurrentMockdLeagueSeason(["Cam", "Seth"], {
      ...leagueConfig,
      teams: 2,
    });
    const teams = season.teams.map(({
      managerDisplayNames: omittedManagers,
      abbreviation: omittedAbbreviation,
      ...team
    }) => {
      void omittedManagers;
      void omittedAbbreviation;
      return { ...team, draftOrderPosition: 1 };
    });

    expect(leagueSeasonSetupRevision({ ...season, teams })).toMatch(/^[\w-]{43}$/u);
  });
});
