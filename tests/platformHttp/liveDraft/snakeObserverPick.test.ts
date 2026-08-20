import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, snakePlayerCatalog, snakeSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
  it("keeps an observer with an on-clock team assignment read-only", async () => {
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
    const commissioner = await createLoggedInAccount(handle, "snake-observer-owner@example.com");
    const observer = await createLoggedInAccount(handle, "snake-observer@example.com");
    const season = snakeSeason();
    const onClockTeam = season.teams[0];
    const commissionerTeam = season.teams[1];
    if (onClockTeam === undefined || commissionerTeam === undefined) {
      throw new Error("Expected two snake fixture teams.");
    }

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: commissioner.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: commissioner.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: commissionerTeam.ownerId,
            teamId: commissionerTeam.id,
          },
          {
            userId: observer.account.id,
            leagueId: season.leagueId,
            role: "observer",
            ownerId: onClockTeam.ownerId,
            teamId: onClockTeam.id,
          },
        ],
      },
    });
    await handle({
      method: "POST",
      path: `/seasons/${season.id}/live-room`,
      sessionToken: commissioner.sessionToken,
      body: {},
    });
    const roomId = `room-${season.id}-real`;
    await handle({
      method: "POST",
      path: `/live-rooms/${roomId}/start`,
      sessionToken: commissioner.sessionToken,
      body: { expectedRevision: 1, idempotencyKey: "start-observer-room" },
    });

    const room = await handle({
      method: "GET",
      path: `/live-rooms/${roomId}`,
      sessionToken: observer.sessionToken,
    });
    const attemptedPick = await handle({
      method: "POST",
      path: `/live-rooms/${roomId}/sales`,
      sessionToken: observer.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "observer-pick-denied",
        structuredSale: { teamId: onClockTeam.id, playerName: "Player 1" },
      },
    });

    expect(room).toMatchObject({
      status: 200,
      body: { room: { role: "observer", canMutateRoom: false, canLogPick: false } },
    });
    expect(attemptedPick).toMatchObject({
      status: 403,
      body: { error: { code: "mutation_denied" } },
    });
  });
});
