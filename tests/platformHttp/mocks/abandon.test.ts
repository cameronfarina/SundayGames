import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, now, playerCatalog, snakePlayerCatalog, snakeSeason, vi } from "../support/index.js";
import type { PlatformHttpHandler } from "../support/index.js";

describe("platform HTTP contract", () => {
it("lets an owner abandon their season mock and durably releases its active quota", async () => {
    const resourcePolicy = {
      maxActiveSessionsPerUser: 1,
      maxActiveSessionsPerUserSeason: 1,
      maxCreationsPerWindow: 100,
    };
    const store = new InMemoryPlatformStore(undefined, {
      mockDraftSessionResourcePolicy: resourcePolicy,
    });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    let setupAvailable = true;
    const setupProvider = vi.fn(async () => {
      if (!setupAvailable) throw new Error("Draft setup is temporarily unavailable.");
      return { playerCatalog: snakePlayerCatalog, initialRosters: [] };
    });
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider: setupProvider });
    const owner11 = await createLoggedInAccount(handle, "mock-abandon-owner@example.com");
    const rival = await createLoggedInAccount(handle, "mock-abandon-rival@example.com");
    const season = snakeSeason();
    const camTeam = season.teams[0];
    const rivalTeam = season.teams[1];
    if (camTeam === undefined || rivalTeam === undefined) throw new Error("Expected two team fixtures.");
    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: owner11.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
          {
            userId: rival.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: rivalTeam.ownerId,
            teamId: rivalTeam.id,
          },
        ],
      },
    });
    const createMock = (handler: PlatformHttpHandler, createdAt: Date) => handler({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner11.sessionToken,
      now: createdAt,
      body: { seasonId: season.id, strategy: "balanced" },
    });
    const created = await createMock(handle, now);
    const createdSession = expectBodyRecord(expectBodyRecord(created.body).mockSession);
    const sessionId = expectString(createdSession.id);
    const revision = Number(createdSession.revision);

    await expect(createMock(handle, new Date(now.getTime() + 1_000))).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "season_active_session_limit" } },
    });
    setupAvailable = false;
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: rival.sessionToken,
      now: new Date(now.getTime() + 2_000),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 404,
      body: { error: { code: "session_not_found" } },
    });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 3_000),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: {
          id: sessionId,
          status: "abandoned",
          abandonedAt: new Date(now.getTime() + 3_000),
        },
      },
    });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${sessionId}/abandon`,
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 3_500),
      body: { seasonId: season.id, expectedRevision: revision },
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "session_not_writable" } },
    });
    expect(setupProvider).toHaveBeenCalledTimes(1);

    const restoredStore = new InMemoryPlatformStore(store.snapshot(), {
      mockDraftSessionResourcePolicy: resourcePolicy,
    });
    const restoredHandle = createPlatformHttpHandler(
      createPlatformApp({ store: restoredStore, simulationRunner: mockRunner }),
      { liveDraftRoomSetupProvider: setupProvider },
    );
    setupAvailable = true;
    await expect(createMock(restoredHandle, new Date(now.getTime() + 4_000))).resolves.toMatchObject({
      status: 201,
      body: { mockSession: { status: "setup" } },
    });
  });
});
