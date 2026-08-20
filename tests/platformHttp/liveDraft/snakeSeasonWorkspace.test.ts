import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, snakePlayerCatalog, snakeSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
  it("lets a commissioner provision a snake room from the season workspace", async () => {
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
    });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({
        playerCatalog: snakePlayerCatalog,
        initialRosters: [],
      }),
    });
    const owner11 = await createLoggedInAccount(handle, "snake-commissioner@example.com");
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
      path: `/seasons/${season.id}/live-room`,
      sessionToken: owner11.sessionToken,
      body: {},
    });

    expect(response).toMatchObject({
      status: 201,
      body: {
        room: {
          roomId: `room-${season.id}-real`,
          picks: [
            { overall: 1, teamId: "snake-team-1" },
            { overall: 2, teamId: "snake-team-2" },
            { overall: 3, teamId: "snake-team-3" },
            { overall: 4, teamId: "snake-team-4" },
            { overall: 5, teamId: "snake-team-4" },
            { overall: 6, teamId: "snake-team-3" },
            { overall: 7, teamId: "snake-team-2" },
            { overall: 8, teamId: "snake-team-1" },
          ],
          onTheClock: { overall: 1, teamId: "snake-team-1" },
        },
      },
    });
  });
});
