import { InMemoryPlatformStore, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, snakePlayerCatalog, snakeSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
  it("lets the manager on the clock record their own snake pick", async () => {
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
    const commissioner = await createLoggedInAccount(handle, "snake-owner@example.com");
    const manager = await createLoggedInAccount(handle, "snake-manager@example.com");
    const season = snakeSeason();
    const firstTeam = season.teams[0];
    const commissionerTeam = season.teams[1];
    if (firstTeam === undefined || commissionerTeam === undefined) {
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
            userId: manager.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: firstTeam.ownerId,
            teamId: firstTeam.id,
          },
        ],
      },
    });
    const created = await handle({
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
      body: { expectedRevision: 1, idempotencyKey: "start-snake-room" },
    });
    const beforePick = await handle({
      method: "GET",
      path: `/live-rooms/${roomId}`,
      sessionToken: manager.sessionToken,
    });

    const picked = await handle({
      method: "POST",
      path: `/live-rooms/${roomId}/sales`,
      sessionToken: manager.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "manager-pick-1",
        command: `${firstTeam.ownerDisplayName} drafted Player 1`,
      },
    });
    const outOfTurn = await handle({
      method: "POST",
      path: `/live-rooms/${roomId}/sales`,
      sessionToken: manager.sessionToken,
      body: {
        expectedRevision: 3,
        idempotencyKey: "manager-pick-out-of-turn",
        structuredSale: { teamId: commissionerTeam.id, playerName: "Player 2" },
      },
    });

    expect(created.status).toBe(201);
    expect(beforePick).toMatchObject({
      status: 200,
      body: { room: { role: "member", canMutateRoom: false, canLogPick: true } },
    });
    expect(picked).toMatchObject({
      status: 200,
      body: {
        room: {
          revision: 3,
          role: "member",
          canLogPick: false,
          salesLog: [{ playerName: "Player 1", teamId: firstTeam.id }],
          onTheClock: { overall: 2, teamId: "snake-team-2" },
        },
      },
    });
    expect(outOfTurn).toMatchObject({
      status: 403,
      body: { error: { code: "mutation_denied" } },
    });
  });
});
