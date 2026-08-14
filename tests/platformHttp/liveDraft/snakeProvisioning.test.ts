import { InMemoryLiveDraftRoomRepository, InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now, playerCatalog, snakePlayerCatalog, snakeSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
it("returns a typed conflict without persisting a snake hosted room through provisioning", async () => {
    const liveDraftRoomRepository = new InMemoryLiveDraftRoomRepository();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      liveDraftRoomRepository,
      simulationRunner: mockRunner,
    });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
    });
    const owner11 = await createLoggedInAccount(handle, "snake-hosted-room@example.com");
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

    const response = await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: owner11.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_snake",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: snakePlayerCatalog,
        now,
      },
    });

    expect(response).toEqual({
      status: 409,
      body: {
        error: {
          code: "snake_live_room_unavailable",
          message: "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
        },
      },
    });
    expect(liveDraftRoomRepository.rooms()).toEqual([]);
  });
});
