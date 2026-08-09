import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  assessLeagueSeasonReadiness,
  buildCurrentMockdLeagueSeason,
  calculateKeeperCost,
} from "../src/platform/leagueSeason.js";

describe("buildCurrentMockdLeagueSeason", () => {
  it("converts the current static config into a hosted league season", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);

    expect(season.league).toEqual({
      id: "league-214674",
      externalLeagueId: "214674",
      name: "Mockd",
      provider: "mockd",
    });
    expect(season.id).toBe("league-214674-season-2026");
    expect(season.seasonYear).toBe(2026);
    expect(season.setupStatus).toBe("draft");
    expect(season.teams).toHaveLength(14);
    expect(season.teams[0]).toEqual({
      id: "league-214674-season-2026-team-01-beaton",
      leagueSeasonId: "league-214674-season-2026",
      ownerId: "owner-beaton",
      ownerDisplayName: "Beaton",
      displayName: "Beaton",
      draftOrderPosition: 1,
    });
    expect(season.teams.map(team => team.ownerDisplayName)).toEqual([...ownerOrder]);
    expect(season.settings.auction.budgetDollars).toBe(200);
    expect(season.settings.roster.rosterSize).toBe(16);
  });

  it("preserves lineup settings and roster maximums from the existing config", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);

    expect(season.settings.roster.lineup).toEqual(leagueConfig.lineup);
    expect(season.settings.roster.rosterMaximums).toEqual(leagueConfig.rosterMaximums);
    expect(season.settings.roster.lineupSlotCount).toBe(16);
  });

  it("defaults keeper cost to a 20 percent increase rounded up", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);

    expect(season.settings.keeperPolicy).toEqual({
      mode: "previous-cost-multiplier",
      multiplier: 1.2,
      rounding: "ceil",
    });
    expect(calculateKeeperCost(season.settings.keeperPolicy, 41)).toBe(50);
    expect(calculateKeeperCost(season.settings.keeperPolicy, 3)).toBe(4);
  });

  it("lets two seasons coexist with distinct IDs and settings", () => {
    const season2026 = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      seasonYear: 2026,
      draft: { scheduledAt: "2026-08-24T23:00:00.000Z", timezone: "America/New_York" },
    });
    const season2027 = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 12), {
      ...leagueConfig,
      teams: 12,
      auctionBudget: 250,
      rosterSize: 15,
      lineup: {
        ...leagueConfig.lineup,
        BENCH: 6,
      },
    }, {
      seasonYear: 2027,
      setupStatus: "published",
    });

    expect(season2026.id).toBe("league-214674-season-2026");
    expect(season2027.id).toBe("league-214674-season-2027");
    expect(season2026.draft).toEqual({
      scheduledAt: "2026-08-24T23:00:00.000Z",
      timezone: "America/New_York",
    });
    expect(season2027.teams).toHaveLength(12);
    expect(season2027.settings.auction.budgetDollars).toBe(250);
    expect(season2027.settings.roster.rosterSize).toBe(15);
    expect(season2027.settings.roster.lineupSlotCount).toBe(15);
    expect(season2027.setupStatus).toBe("published");
  });
});

describe("assessLeagueSeasonReadiness", () => {
  it("reports blockers for missing teams and invalid settings", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 13), {
      ...leagueConfig,
      auctionBudget: 0,
      rosterSize: 17,
    });

    const readiness = assessLeagueSeasonReadiness(season);

    expect(readiness.status).toBe("fail");
    expect(readiness.canPublish).toBe(false);
    expect(readiness.canLock).toBe(false);
    expect(readiness.blockers).toEqual([
      "Expected 14 teams, but found 13.",
      "Auction budget must be greater than $0.",
      "Roster size is 17, but lineup slots add up to 16.",
    ]);
  });

  it("warns when a valid season is ready to publish and passes after publish or lock", () => {
    const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const publishedSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      setupStatus: "published",
    });
    const lockedSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      setupStatus: "locked",
    });

    expect(assessLeagueSeasonReadiness(draftSeason)).toMatchObject({
      status: "warn",
      canPublish: true,
      canLock: false,
      blockers: [],
      warnings: ["Season is ready but has not been published."],
    });
    expect(assessLeagueSeasonReadiness(publishedSeason)).toMatchObject({
      status: "pass",
      canPublish: false,
      canLock: true,
      blockers: [],
      warnings: [],
    });
    expect(assessLeagueSeasonReadiness(lockedSeason)).toMatchObject({
      status: "pass",
      canPublish: false,
      canLock: false,
      blockers: [],
      warnings: [],
    });
  });
});
