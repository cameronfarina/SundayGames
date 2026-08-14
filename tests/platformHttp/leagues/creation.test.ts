import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, defaultScoringSettings, describe, expect, expectBodyRecord, expectString, it, mockRunner, now } from "../support/index.js";

describe("platform HTTP contract", () => {
it("creates a confirmed league for the signed-in commissioner with generated ids", async () => {
    const store = new InMemoryPlatformStore();
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const login = await createLoggedInAccount(handle, "league-creator@example.com");
    const setup = {
      provider: "espn",
      externalLeagueId: "100001",
      leagueName: "The Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "Short King", managerNames: ["Owner11"] },
        { externalTeamId: "2", displayName: "Dart Vader", managerNames: ["Owner01"] },
        { externalTeamId: "3", displayName: "Old Dogs", managerNames: ["Jacob"] },
        { externalTeamId: "4", displayName: "Peace Bridge", managerNames: ["Nick"] },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 },
    };

    await expect(handle({ method: "POST", path: "/leagues", body: { setup } }))
      .resolves.toMatchObject({ status: 401 });
    const response = await handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      body: { setup },
    });

    expect(response).toMatchObject({
      status: 201,
      body: {
        season: {
          id: expect.stringMatching(/^season-/),
          leagueId: expect.stringMatching(/^league-/),
          setupStatus: "draft",
          settings: { draftFormat: "auction" },
        },
      },
    });
    const createdSeasonBody = expectBodyRecord(expectBodyRecord(response.body).season);
    const leagueId = expectString(createdSeasonBody.leagueId);
    const createdSeasonId = expectString(createdSeasonBody.id);
    expect(await app.listLeagueMemberships(leagueId)).toEqual([
      expect.objectContaining({ userId: login.account.id, leagueId, role: "owner" }),
    ]);
    const registeredSeason = store.findLeagueSeason(createdSeasonId);
    if (registeredSeason === null) throw new Error("Expected the created league season.");
    await expect(handle({
      method: "POST",
      path: `/seasons/${createdSeasonId}/publish`,
      sessionToken: login.sessionToken,
      body: {},
    })).resolves.toMatchObject({
      status: 400,
      body: { error: { code: "season_review_confirmation_required" } },
    });
    await expect(handle({
      method: "POST",
      path: `/seasons/${createdSeasonId}/publish`,
      sessionToken: login.sessionToken,
      body: { confirmed: true },
    })).resolves.toMatchObject({
      status: 200,
      body: { season: { id: createdSeasonId, setupStatus: "published" } },
    });

    const member = await createLoggedInAccount(handle, "league-member@example.com");
    await app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season: registeredSeason,
      memberships: [
        { userId: login.account.id, leagueId: registeredSeason.leagueId, role: "owner" },
        { userId: member.account.id, leagueId: registeredSeason.leagueId, role: "member" },
      ],
      now,
    });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
      sessionToken: member.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: `/leagues/${registeredSeason.leagueId}/archive`,
      sessionToken: login.sessionToken,
      now: new Date(now.getTime() + 1),
    })).resolves.toEqual({
      status: 200,
      body: { archived: true, leagueId: registeredSeason.leagueId },
    });
    await expect(handle({
      method: "GET",
      path: `/seasons/${registeredSeason.id}`,
      sessionToken: login.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { season: { id: registeredSeason.id } } });
  });

it("returns a retryable response when the account league-creation window is full", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      leagueCreationLimits: {
        maxActiveLeaguesPerAccount: 10,
        maxCreatedLeaguesPerWindow: 1,
        creationWindowMs: 60 * 60 * 1_000,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const login = await createLoggedInAccount(handle, "limited-league-creator@example.com");
    const setup = {
      provider: "espn",
      externalLeagueId: "100001",
      leagueName: "The Sunday Games",
      seasonYear: 2026,
      expectedTeamCount: 4,
      teams: [
        { externalTeamId: "1", displayName: "Short King", managerNames: ["Owner11"] },
        { externalTeamId: "2", displayName: "Dart Vader", managerNames: ["Owner01"] },
        { externalTeamId: "3", displayName: "Old Dogs", managerNames: ["Jacob"] },
        { externalTeamId: "4", displayName: "Peace Bridge", managerNames: ["Nick"] },
      ],
      draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
      scoring: { ...defaultScoringSettings },
      rosterSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7 },
    };

    await expect(handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      now,
      body: { setup },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/leagues",
      sessionToken: login.sessionToken,
      now: new Date(now.getTime() + 30_000),
      body: { setup: { ...setup, externalLeagueId: "214675" } },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "3570" },
      body: {
        error: {
          code: "league_creation_rate_limited",
          message: "Too many leagues were created recently. Try again later.",
        },
      },
    });
  });
});
