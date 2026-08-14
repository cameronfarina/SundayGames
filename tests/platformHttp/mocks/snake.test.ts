import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectBodyRecord, expectString, it, mockRunner, playerCatalog, snakePlayerCatalog, snakeSeason } from "../support/index.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../support/index.js";

describe("platform HTTP contract", () => {
it("creates and replays a league-aware snake mock for the claimed team", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    let currentSnakeCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = snakePlayerCatalog;
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({ playerCatalog: currentSnakeCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "snake-mock@example.com");
    const season = snakeSeason();
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
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    const created = await handle({
      method: "POST",
      path: "/season-mock-drafts",
      sessionToken: owner11.sessionToken,
      body: { seasonId: season.id },
    });
    expect(created).toMatchObject({
      status: 201,
      body: {
        mockSession: {
          seasonId: season.id,
          teamId: "snake-team-1",
          draftMode: {
            format: "snake",
          },
          configurationSnapshot: {
            status: "ready",
            schema: "mockd-season-mock",
            version: 2,
          },
        },
        state: { session: { status: "setup", revision: 0 } },
      },
    });
    const mockSession = expectBodyRecord(expectBodyRecord(created.body).mockSession);
    const mockSessionId = expectString(mockSession.id);

    const started = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSessionId}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "start-1",
        command: { type: "start", expectedRevision: 0 },
      },
    });
    expect(started).toMatchObject({
      status: 200,
      body: { state: { session: { status: "active", revision: 1, currentPick: { teamId: "snake-team-1" } } } },
    });

    const picked = await handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-1",
        command: { type: "pick", expectedRevision: 1, playerId: "player 1" },
      },
    });
    expect(picked).toMatchObject({
      status: 200,
      body: {
        state: {
          session: { revision: 2, currentPick: { overall: 8, teamId: "snake-team-1" } },
          board: {
            picks: expect.arrayContaining([
              expect.objectContaining({ selection: expect.objectContaining({ source: "ai" }) }),
            ]),
          },
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-1",
        command: { type: "pick", expectedRevision: 1, playerId: "player 1" },
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: { commandLog: [{}, {}] },
        state: { session: { revision: 2 } },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "stale-pick",
        command: { type: "pick", expectedRevision: 1, playerId: "player 8" },
      },
    })).resolves.toMatchObject({ status: 409, body: { error: { code: "stale_revision" } } });

    currentSnakeCatalog = [{ name: "Replacement Player", position: "RB", expectedPrice: 1 }];
    await expect(handle({
      method: "GET",
      path: `/season-mock-drafts/${mockSession.id}`,
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        state: {
          session: { revision: 2, commandLog: expect.any(Array) },
          board: { players: expect.arrayContaining([expect.objectContaining({ name: "Player 1" })]) },
        },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "pick-2",
        command: { type: "pick", expectedRevision: 2, playerId: "player 8" },
      },
    })).resolves.toMatchObject({ body: { state: { session: { canComplete: true, revision: 3 } } } });
    await expect(handle({
      method: "POST",
      path: `/season-mock-drafts/${mockSession.id}/commands`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        commandId: "complete-1",
        command: { type: "complete", expectedRevision: 3 },
      },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        mockSession: { status: "completed" },
        state: { session: { status: "completed", revision: 4 } },
        results: {
          teams: expect.arrayContaining([
            expect.objectContaining({
              teamId: "snake-team-1",
              isUserTeam: true,
              rank: expect.any(Number),
              roster: expect.arrayContaining([
                expect.objectContaining({ playerName: "Player 1", week1Points: 0 }),
              ]),
            }),
          ]),
          rosteredPlayerCount: 8,
        },
      },
    });

    const legacySession = await app.createMockDraftSession({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: season.teams[0]?.ownerId ?? "",
      teamId: season.teams[0]?.id ?? "",
      draftMode: { format: "snake", mockCount: 1, label: "Legacy mock" },
      status: "setup",
    });
    await expect(handle({
      method: "GET",
      path: `/season-mock-drafts/${legacySession.id}`,
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 409,
      body: { error: { code: "snapshot_migration_required" } },
    });
  });
});
