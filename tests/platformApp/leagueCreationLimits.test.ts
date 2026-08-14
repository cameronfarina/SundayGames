import { describe, it, InMemoryPlatformStore, LeagueCreationLimitError, expect, now, seasonForLeague, strictLeagueCreationLimits, type LeagueCreationLimits } from "./support/index.js";

describe("platform app service", () => {
  it("persists active-league quotas and still permits updates to an existing league", () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const firstSeason = seasonForLeague("first");
    const createdByUserId = "account-owner11";
    const firstInput: Parameters<InMemoryPlatformStore["registerLeagueSeason"]>[0] = {
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    };

    expect(store.registerLeagueSeason(firstInput)).toEqual(firstSeason);
    expect(store.registerLeagueSeason({
      ...firstInput,
      season: { ...firstSeason, setupStatus: "published" },
      now: new Date(now.getTime() + 1),
    }).setupStatus).toBe("published");

    const restored = new InMemoryPlatformStore(store.snapshot(), {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const secondSeason = seasonForLeague("second");
    expect(() => restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 2),
    })).toThrow(new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    ));
  });

  it("persists league archives and releases only the active-league quota", () => {
    const limits: LeagueCreationLimits = {
      maxActiveLeaguesPerAccount: 1,
      maxCreatedLeaguesPerWindow: 10,
      creationWindowMs: 60 * 60 * 1_000,
    };
    const store = new InMemoryPlatformStore(undefined, { leagueCreationLimits: limits });
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("archived-first");
    store.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });

    expect(store.archiveLeague({
      leagueId: firstSeason.leagueId,
      archivedByUserId: createdByUserId,
      now: new Date(now.getTime() + 1),
    })).toBe(true);
    expect(store.isLeagueArchived(firstSeason.leagueId)).toBe(true);

    const restored = new InMemoryPlatformStore(store.snapshot(), { leagueCreationLimits: limits });
    expect(restored.isLeagueArchived(firstSeason.leagueId)).toBe(true);
    expect(restored.findLeagueSeason(firstSeason.id)).toEqual(firstSeason);

    const secondSeason = seasonForLeague("active-after-archive");
    expect(restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 2),
    })).toEqual(secondSeason);
  });

  it("enforces the durable per-account league creation window", () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: {
        ...strictLeagueCreationLimits,
        maxActiveLeaguesPerAccount: 10,
      },
    });
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("window-first");
    store.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });
    const secondSeason = seasonForLeague("window-second");

    expect(() => store.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 30_000),
    })).toThrow(new LeagueCreationLimitError(
      "league_creation_rate_limited",
      "Too many leagues were created recently. Try again later.",
      3_570,
    ));
  });

  it("restores active-league ownership from snapshots created before quota metadata", () => {
    const original = new InMemoryPlatformStore();
    const createdByUserId = "account-owner11";
    const firstSeason = seasonForLeague("legacy-snapshot");
    original.registerLeagueSeason({
      season: firstSeason,
      memberships: [{ userId: createdByUserId, leagueId: firstSeason.leagueId, role: "owner" }],
      createdByUserId,
      now,
    });
    const { leagueCreationRecords: _omittedCreationRecords, ...legacySnapshot } = original.snapshot();
    void _omittedCreationRecords;
    const restored = new InMemoryPlatformStore(legacySnapshot, {
      leagueCreationLimits: strictLeagueCreationLimits,
    });
    const secondSeason = seasonForLeague("after-legacy-snapshot");

    expect(() => restored.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: createdByUserId, leagueId: secondSeason.leagueId, role: "owner" }],
      createdByUserId,
      now: new Date(now.getTime() + 1),
    })).toThrow(new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    ));
  });
});
