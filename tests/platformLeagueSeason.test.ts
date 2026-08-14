import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  assessLeagueSeasonReadiness,
  buildCurrentMockdLeagueSeason,
  calculateKeeperCost,
  type AnyLeagueSeason,
} from "../src/platform/leagueSeason.js";

describe("buildCurrentMockdLeagueSeason", () => {
  it("converts the current static config into a hosted league season", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);

    expect(season.league).toEqual({
      id: "league-100001",
      externalLeagueId: "100001",
      name: "Mockd",
      provider: "mockd",
    });
    expect(season.id).toBe("league-100001-season-2026");
    expect(season.seasonYear).toBe(2026);
    expect(season.setupStatus).toBe("draft");
    expect(season.teams).toHaveLength(14);
    expect(season.teams[0]).toEqual({
      id: "league-100001-season-2026-team-01-owner01",
      leagueSeasonId: "league-100001-season-2026",
      ownerId: "owner-owner01",
      ownerDisplayName: "Owner01",
      displayName: "Owner01",
      draftOrderPosition: 1,
    });
    expect(season.teams.map(team => team.ownerDisplayName)).toEqual([...ownerOrder]);
    expect(season.settings.draftFormat).toBe("auction");
    expect(season.settings.auction.budgetDollars).toBe(200);
    expect(season.settings).not.toHaveProperty("snake");
    expect(season.settings.scoring).toEqual(leagueConfig.scoring);
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

    expect(season2026.id).toBe("league-100001-season-2026");
    expect(season2027.id).toBe("league-100001-season-2027");
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

  it("validates snake settings without requiring auction settings", () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: auctionSeason.settings.scoring,
        snake: {
          rounds: 16,
          order: auctionSeason.teams.map(team => team.id),
          reversal: "standard",
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };

    const readiness = assessLeagueSeasonReadiness(snakeSeason);

    expect(readiness.canPublish).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.checks.map(check => check.key)).toContain("snake-draft");
    expect(readiness.checks.map(check => check.key)).not.toContain("auction-budget");
    expect(snakeSeason.settings).not.toHaveProperty("auction");
  });

  it("blocks invalid active-format and scoring settings", () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: {
          ...auctionSeason.settings.scoring,
          passingTouchdown: 0,
          reception: -0.5,
        },
        snake: {
          rounds: 0,
          order: auctionSeason.teams.map(team => team.id).slice(1),
          reversal: "standard",
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };

    const readiness = assessLeagueSeasonReadiness(snakeSeason);

    expect(readiness.canPublish).toBe(false);
    expect(readiness.blockers).toEqual([
      "Snake drafts must have at least one round and include every team exactly once in draft order.",
      "Touchdown points must be greater than 0, and reception points cannot be negative.",
    ]);
  });

  it("accepts standard scoring with zero reception points", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, {
      ...leagueConfig,
      scoring: {
        ...leagueConfig.scoring,
        reception: 0,
      },
    });

    expect(assessLeagueSeasonReadiness(season).canPublish).toBe(true);
  });

  it("blocks invalid auction minimum bids", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    season.settings.auction.minimumBidDollars = 0;

    expect(assessLeagueSeasonReadiness(season).blockers).toContain(
      "Auction minimum bid must be greater than $0 and no more than the budget.",
    );
  });

  it("requires the engine-supported range of four to twenty teams", () => {
    const tooSmall = buildCurrentMockdLeagueSeason(ownerOrder.slice(0, 2), {
      ...leagueConfig,
      teams: 2,
    });
    const tooLargeOwners = Array.from({ length: 21 }, (_, index) => `Owner ${index + 1}`);
    const tooLarge = buildCurrentMockdLeagueSeason(tooLargeOwners, {
      ...leagueConfig,
      teams: 21,
    });

    expect(assessLeagueSeasonReadiness(tooSmall).blockers).toContain(
      "Leagues require between 4 and 20 teams.",
    );
    expect(assessLeagueSeasonReadiness(tooLarge).blockers).toContain(
      "Leagues require between 4 and 20 teams.",
    );
  });

  it("requires unique non-blank team identities", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const firstTeam = season.teams[0];
    const secondTeam = season.teams[1];
    if (firstTeam === undefined || secondTeam === undefined) throw new Error("Expected test teams.");
    season.teams[1] = {
      ...secondTeam,
      id: firstTeam.id,
    };

    expect(assessLeagueSeasonReadiness(season).blockers).toContain(
      "Every team needs a unique non-blank ID and a non-blank name.",
    );
  });

  it("requires whole-dollar auction currency and minimum-bid reserves", () => {
    const fractional = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    fractional.settings.auction.budgetDollars = 200.5;
    const underfunded = buildCurrentMockdLeagueSeason(ownerOrder, {
      ...leagueConfig,
      auctionBudget: 15,
    });

    expect(assessLeagueSeasonReadiness(fractional).blockers).toContain(
      "Auction budget and minimum bid must be positive whole-dollar amounts.",
    );
    expect(assessLeagueSeasonReadiness(underfunded).blockers).toContain(
      "Auction budget must reserve the $1 minimum bid for all 16 roster slots.",
    );
  });

  it("requires positive whole roster slots that match the declared capacity", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    season.settings.roster.lineup.RB = 1.5;

    expect(assessLeagueSeasonReadiness(season).blockers).toContain(
      "Roster size and every lineup slot must be positive whole numbers, and lineup slots must total the roster size.",
    );
  });

  it("requires usable whole-number positional maximums", () => {
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    season.settings.roster.rosterMaximums.RB = 1.5;

    expect(assessLeagueSeasonReadiness(season).blockers).toContain(
      "Roster maximums must be non-negative whole numbers and must support a full roster.",
    );
  });

  it("blocks snake rounds beyond each team's roster capacity", () => {
    const auctionSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig);
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: auctionSeason.settings.scoring,
        snake: {
          rounds: 17,
          order: auctionSeason.teams.map(team => team.id),
          reversal: "standard",
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };

    expect(assessLeagueSeasonReadiness(snakeSeason).blockers).toContain(
      "Snake draft rounds cannot exceed the 16-player roster capacity.",
    );
  });
});
