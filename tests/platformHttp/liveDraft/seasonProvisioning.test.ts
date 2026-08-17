import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectPublicBrowserPayload, it, leagueConfig, mockRunner, ownerOrder, playerCatalog, vi } from "../support/index.js";

describe("platform HTTP contract", () => {
it("provisions a season live room from the server-owned draft setup", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupProvider = vi.fn(async () => ({
      playerCatalog,
      initialRosters: [],
    }));
    const handle = createPlatformHttpHandler(app, { liveDraftRoomSetupProvider });
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");
    const owner04 = await createLoggedInAccount(handle, "owner04@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [
          { userId: owner11.account.id, leagueId: season.leagueId, role: "owner", ownerId: camTeam.ownerId, teamId: camTeam.id },
          { userId: owner04.account.id, leagueId: season.leagueId, role: "member" },
        ],
      },
    });

    const denied = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner04.sessionToken,
      body: {},
    });
    expect(denied).toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });

    const missingSetup = await createPlatformHttpHandler(app)({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
      body: {},
    });
    expect(missingSetup).toEqual({
      status: 409,
      body: {
        error: {
          code: "live_draft_setup_missing",
          message: "Publish this season's player catalog and keepers before creating its live room.",
        },
      },
    });

    const startsAt = "2100-08-16T22:00:00.000Z";
    const created = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
      body: { startsAt },
    });

    expect(liveDraftRoomSetupProvider).toHaveBeenCalledWith(season);
    expect(created).toMatchObject({
      status: 201,
      body: {
        room: {
          roomId: `room-${season.id}-real`,
          seasonId: season.id,
          status: "countdown",
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua" }),
          ]),
          role: "commissioner",
          canMutateRoom: true,
        },
      },
    });
    expectPublicBrowserPayload(created.body);
    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner04.sessionToken,
    })).resolves.toMatchObject({
      status: 403,
      body: { error: { code: "shared_mutation_denied" } },
    });
    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
    })).resolves.toEqual({ status: 200, body: { ok: true } });
    await expect(app.hasLiveDraftRoomForSeason(season.id)).resolves.toBe(false);
    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
      body: {},
    })).resolves.toMatchObject({ status: 201 });
  });
});
