import { InMemoryLiveDraftRoomSetupRepository, InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, expectPublicBrowserPayload, it, leagueConfig, mockRunner, ownerOrder, playerCatalog } from "../support/index.js";
import { verifyKeeperLiveRoomSynchronization } from "../slices/keeperLiveRoomSynchronization.js";

describe("platform HTTP contract", () => {
it("previews, persists, lists, and removes commissioner keeper commands", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const liveDraftRoomSetupRepository = new InMemoryLiveDraftRoomSetupRepository();
    const handle = createPlatformHttpHandler(app, {
      currentPlayerCatalogProvider: async () => playerCatalog,
      liveDraftRoomSetupRepository,
      liveDraftRoomSetupProvider: async () => ({ playerCatalog, initialRosters: [] }),
    });
    const owner11 = await createLoggedInAccount(handle, "keeper-commissioner@example.com");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "draft" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
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
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      },
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/preview`,
      sessionToken: owner11.sessionToken,
      body: { command: "owner11 keeping achane 50" },
    })).resolves.toMatchObject({
      status: 200,
      body: {
        kind: "preview",
        team: { id: camTeam.id },
        player: { name: "De'Von Achane", position: "RB" },
        keeper: { auctionCostDollars: 50 },
      },
    });

    await expect(handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: owner11.sessionToken,
      body: { command: "owner11 keeping achane 50", confirmed: false },
    })).resolves.toMatchObject({ status: 400, body: { error: { code: "keeper_confirmation_required" } } });

    const applied = await handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: owner11.sessionToken,
      body: { command: "owner11 keeping achane 50", confirmed: true },
    });
    expect(applied).toMatchObject({
      status: 200,
      body: {
        keepers: [{ teamId: camTeam.id, playerId: "devon achane", price: 50 }],
        pricing: { snapshots: [{ rows: expect.any(Array) }] },
      },
    });
    await expect(handle({
      method: "GET",
      path: "/player-catalog",
      query: { seasonId: season.id },
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({
      status: 200,
      body: {
        draftFormat: "auction",
        personalized: true,
        strategyKey: "balanced",
        players: expect.arrayContaining([
          expect.objectContaining({ marketPrice: 55, myValue: 55, leagueValue: 55 }),
          expect.objectContaining({
            name: "De'Von Achane",
            isKeeper: true,
            keeperTeamId: camTeam.id,
            keeperPrice: 50,
          }),
        ]),
      },
    });
    await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
      initialRosters: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 50 }],
    });

    await expect(handle({
      method: "GET",
      path: `/seasons/${season.id}/keepers`,
      sessionToken: owner11.sessionToken,
    })).resolves.toMatchObject({ status: 200, body: { keepers: [{ playerName: "De'Von Achane" }] } });

    await expect(handle({
      method: "DELETE",
      path: `/seasons/${season.id}/keepers`,
      sessionToken: owner11.sessionToken,
      body: { teamId: camTeam.id, playerId: "devon achane" },
    })).resolves.toMatchObject({ status: 200, body: { keepers: [] } });

    await handle({
      method: "POST",
      path: `/seasons/${season.id}/keepers/apply`,
      sessionToken: owner11.sessionToken,
      body: { command: "owner11 keeping achane 50", confirmed: true },
    });
    await handle({
      method: "POST",
      path: `/seasons/${season.id}/publish`,
      sessionToken: owner11.sessionToken,
      body: { confirmed: true },
    });
    const createdRoomResponse = await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
      body: {},
    });
    expect(createdRoomResponse).toMatchObject({
      status: 201,
      body: {
        room: {
          board: expect.arrayContaining([
            expect.objectContaining({ name: "Puka Nacua", marketPrice: 55, expectedPrice: 55 }),
          ]),
          teamSummaries: expect.arrayContaining([
            expect.objectContaining({
              teamId: camTeam.id,
              spent: 50,
              budgetRemaining: 150,
              rosterSlotsRemaining: 15,
              roster: [expect.objectContaining({ name: "De'Von Achane", source: "keeper", price: 50 })],
            }),
          ]),
        },
      },
    });
    expectPublicBrowserPayload(createdRoomResponse.body);
    await verifyKeeperLiveRoomSynchronization({
      app,
      handle,
      liveDraftRoomSetupRepository,
      owner11,
      season,
      camTeam,
    });
  });
});
