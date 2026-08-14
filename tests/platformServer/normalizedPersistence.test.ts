import { FakeTransactionalPlatformPostgresClient, buildCurrentMockdLeagueSeason, completeInitialRostersFor, createPlatformServer, expect, it, jsonFetch, leagueConfig, listen, mockRunner, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("uses normalized Postgres live room and export artifact repositories across server restart", async () => {
    const postgresClient = new FakeTransactionalPlatformPostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    const accountId = stringProperty(propertyValue(created.body, "account"), "id");
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [
          {
            userId: accountId,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
      }),
    });

    const roomCreated = await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_postgres_normalized",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
        initialRosters: completeInitialRostersFor(season, camTeam.id),
      }),
    });
    const rollbacksBeforeConflict = postgresClient.transactionsRolledBack;
    const failedStart = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 99,
        idempotencyKey: "start:room_postgres_normalized:stale",
      }),
    });
    expect(failedStart.status).toBe(409);
    expect(postgresClient.transactionsRolledBack).toBe(rollbacksBeforeConflict + 1);
    expect(postgresClient.events).toHaveLength(1);
    expect(postgresClient.rooms.get("room_postgres_normalized")?.current_revision).toBe(1);
    const roomStarted = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_postgres_normalized",
      }),
    });
    const saleLogged = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/sales", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "sale:puka:62",
        sale: "owner11 puka 62",
      }),
    });
    const roomEnded = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 3,
        idempotencyKey: "end:room_postgres_normalized",
      }),
    });
    const exportArtifact = await jsonFetch(baseUrl, "/live-rooms/room_postgres_normalized/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:05:00.000Z",
      }),
    });
    const artifactId = stringProperty(propertyValue(exportArtifact.body, "artifact"), "id");
    const snapshot = postgresClient.row?.snapshot_json;

    expect(platformServer.postgresLiveDraftRoomRepository).toBeDefined();
    expect(platformServer.postgresExportArtifactRepository).toBeDefined();
    expect(roomCreated.status).toBe(201);
    expect(roomStarted).toMatchObject({
      status: 200,
      body: { room: { revision: 2, status: "live" } },
    });
    expect(postgresClient.advisoryLockKeys).toContain(`mockd:draft-mutation:${season.id}`);
    expect(saleLogged).toMatchObject({
      status: 200,
      body: {
        room: {
          revision: 3,
          salesLog: [
            expect.objectContaining({
              playerName: "Puka Nacua",
              price: 62,
            }),
          ],
        },
      },
    });
    expect(roomEnded).toMatchObject({
      status: 200,
      body: { room: { revision: 4, status: "ended" } },
    });
    expect(exportArtifact).toMatchObject({
      status: 201,
      body: {
        artifact: {
          id: artifactId,
          roomId: "room_postgres_normalized",
          sourceRevision: 4,
        },
        content: expect.stringContaining("Puka Nacua,62"),
      },
    });
    expect(postgresClient.events.map(event => [event.revision, event.event_type])).toEqual([
      [1, "room_created"],
      [2, "room_started"],
      [3, "sale_logged"],
      [4, "room_ended"],
    ]);
    expect([...postgresClient.sales.values()]).toMatchObject([
      {
        draft_room_id: "room_postgres_normalized",
        player_name: "Puka Nacua",
        status: "active",
      },
    ]);
    expect(postgresClient.exports.get(artifactId)).toMatchObject({
      created_by_user_id: accountId,
      draft_room_id: "room_postgres_normalized",
      source_revision: 4,
    });
    expect(postgresClient.exportContents).toHaveLength(1);
    expect(postgresClient.row?.revision).toBe(3);
    expect(snapshot).toMatchObject({
      liveDraftRooms: [],
      exportArtifacts: [],
      exportArtifactContents: [],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const reloadedRoom = await jsonFetch(loadedBaseUrl, "/live-rooms/room_postgres_normalized", {
      headers: { "x-session-token": sessionToken },
    });
    const retriedArtifact = await jsonFetch(loadedBaseUrl, "/live-rooms/room_postgres_normalized/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:06:00.000Z",
      }),
    });

    expect(loadedServer.postgresLiveDraftRoomRepository).toBeDefined();
    expect(loadedServer.postgresExportArtifactRepository).toBeDefined();
    expect(reloadedRoom).toMatchObject({
      status: 200,
      body: {
        room: {
          roomId: "room_postgres_normalized",
          status: "ended",
          revision: 4,
          salesLog: [
            expect.objectContaining({
              playerName: "Puka Nacua",
              price: 62,
            }),
          ],
        },
      },
    });
    expect(retriedArtifact).toEqual(exportArtifact);
    expect(postgresClient.exports).toHaveLength(1);
    expect(postgresClient.exportContents).toHaveLength(1);
  });
});
