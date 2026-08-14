import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, now, playerCatalog, snakePlayerCatalog, snakeSeason, vi } from "../support/index.js";

describe("platform HTTP contract", () => {
it("returns a typed retry response when interactive mock creation is rate limited", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxActiveSessionsPerUser: 100,
        maxActiveSessionsPerUserSeason: 100,
        maxCreationsPerWindow: 2,
        creationWindowMs: 60_000,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const setupProvider = vi.fn(async () => ({ playerCatalog: snakePlayerCatalog, initialRosters: [] }));
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider: setupProvider });
    const owner11 = await createLoggedInAccount(handle, "mock-rate-limit@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMock = (createdAt: Date) => handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner11.sessionToken,
      now: createdAt,
      body: {
        seasonId: season.id,
        strategy: "balanced",
      },
    });

    await expect(createMock(now)).resolves.toMatchObject({ status: 201 });
    await expect(createMock(new Date(now.getTime() + 1_000))).resolves.toMatchObject({ status: 201 });
    await expect(createMock(new Date(now.getTime() + 2_000))).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "58" },
      body: {
        error: {
          code: "session_creation_rate_limited",
          message: "Too many mock drafts were started recently. Try again later.",
        },
      },
    });
    expect(setupProvider).toHaveBeenCalledTimes(2);
  });

it("returns the typed active-session quota response when reset would reactivate past the limit", async () => {
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: {
        maxActiveSessionsPerUser: 2,
        maxActiveSessionsPerUserSeason: 1,
        maxCreationsPerWindow: 100,
      },
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app);
    const owner11 = await createLoggedInAccount(handle, "mock-reset-limit@example.com");
    const season = snakeSeason();
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected a team fixture.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: team.ownerId,
          teamId: team.id,
        }],
      },
    });
    const createMock = (createdAt: Date) => handle({
      method: "POST",
      path: "/mock-sessions",
      sessionToken: owner11.sessionToken,
      now: createdAt,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        draftMode: { format: "snake", mockCount: 1 },
      },
    });
    const completedResponse = await createMock(now);
    const completedSession = expectBodyRecord(expectBodyRecord(completedResponse.body).mockSession);
    const completedSessionId = expectString(completedSession.id);
    store.mockDraftSessions.markCompleted({
      userId: owner11.account.id,
      sessionId: completedSessionId,
      expectedRevision: 1,
      now: new Date(now.getTime() + 1_000),
    });
    await expect(createMock(new Date(now.getTime() + 2_000))).resolves.toMatchObject({ status: 201 });

    await expect(handle({
      method: "POST",
      path: `/mock-sessions/${completedSessionId}/reset`,
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { expectedRevision: 1 },
    })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "season_active_session_limit",
          message: "Finish or abandon an active mock draft for this season before starting another.",
        },
      },
    });
  });
});
