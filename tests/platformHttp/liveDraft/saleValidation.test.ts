import { InMemoryPlatformStore, buildCurrentMockdLeagueSeason, createLoggedInAccount, createPlatformApp, createPlatformHttpHandler, describe, expect, it, leagueConfig, mockRunner, now, ownerOrder, playerCatalog, postDraftScoringSettingsIdForSeason } from "../support/index.js";

describe("platform HTTP contract", () => {
it("returns user-facing live sale validation errors through the HTTP boundary", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
      currentPlayerCatalogProvider: async () => playerCatalog,
      postDraftProjectionProvider: async (projectionSeason, catalog, evaluatedAt) => ({
        metadata: {
          snapshotId: "test-projections",
          leagueId: projectionSeason.leagueId,
          seasonId: projectionSeason.id,
          scoringSettingsId: postDraftScoringSettingsIdForSeason(projectionSeason),
          generatedAt: evaluatedAt.toISOString(),
          validThrough: new Date(evaluatedAt.getTime() + 60_000).toISOString(),
          week: 1,
        },
        projections: catalog.map((player, index) => ({
          playerId: `player-${index + 1}`,
          playerName: player.name,
          position: player.position,
          seasonProjectedPoints: Math.max(1, player.expectedPrice) * 4,
          weeklyProjectedPoints: Math.max(1, player.expectedPrice),
        })),
      }),
    });
    const owner11 = await createLoggedInAccount(handle, "owner11@example.com");
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
          {
            userId: owner11.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
        now,
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms",
      sessionToken: owner11.sessionToken,
      headers: { "x-mockd-provisioning-token": "test-provisioning-token" },
      body: {
        seasonId: season.id,
        roomId: "room_wr_limit",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog,
        initialRosters: [
          { teamId: camTeam.id, playerName: "WR One", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Two", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Three", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Four", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Five", position: "WR", price: 1 },
          { teamId: camTeam.id, playerName: "WR Six", position: "WR", price: 1 },
        ],
        now,
      },
    });

    await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/start",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 1,
        idempotencyKey: "start-room-wr-limit",
        now: new Date(now.getTime() + 1_000),
      },
    });

    const overLimitSale = await handle({
      method: "POST",
      path: "/live-rooms/room_wr_limit/sales",
      sessionToken: owner11.sessionToken,
      body: {
        expectedRevision: 2,
        idempotencyKey: "sale:legette:2",
        sale: "owner11 legette 2",
        now: new Date(now.getTime() + 2_000),
      },
    });

    expect(overLimitSale).toEqual({
      status: 409,
      body: {
        error: {
          code: "position_limit",
          message: "Owner11 cannot buy Xavier Legette: roster limit is 6 WRs.",
        },
      },
    });
  });
});
