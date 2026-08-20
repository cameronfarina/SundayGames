import { AsyncLeagueSetupRepository, FakePostgresClient, FakeTransactionalPlatformPostgresClient, buildCurrentMockdLeagueSeason, completeInitialRostersFor, expect, it, jsonFetch, leagueConfig, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("uses app authorization for normalized live rooms when league setup is external", async () => {
    const postgresClient = new FakePostgresClient();
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const liveDraftRoomClient = new FakeTransactionalPlatformPostgresClient();
    const { baseUrl } = await createListeningServer({
      postgresClient,
      leagueSetupRepository,
      postgresLiveDraftRoomClient: liveDraftRoomClient,
      postgresExportArtifactClient: liveDraftRoomClient,
    });

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password1!",
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

    await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
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
        roomId: "room_external_setup",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
        initialRosters: completeInitialRostersFor(season),
      }),
    });
    const roomStarted = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_external_setup",
      }),
    });
    const roomEnded = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/end", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 2,
        idempotencyKey: "end:room_external_setup",
      }),
    });
    const exportArtifact = await jsonFetch(baseUrl, "/live-rooms/room_external_setup/export-artifacts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        exportedAt: "2026-08-09T12:05:00.000Z",
      }),
    });
    const snapshot = postgresClient.row?.snapshot_json;

    expect(roomCreated.status).toBe(201);
    expect(roomStarted).toMatchObject({
      status: 200,
      body: { room: { revision: 2, status: "live" } },
    });
    expect(roomEnded).toMatchObject({
      status: 200,
      body: { room: { revision: 3, status: "ended" } },
    });
    expect(exportArtifact).toMatchObject({
      status: 201,
      body: {
        artifact: {
          roomId: "room_external_setup",
          sourceRevision: 3,
        },
      },
    });
    expect(snapshot).toMatchObject({
      leagueSeasons: [],
      memberships: [],
      liveDraftRooms: [],
      exportArtifacts: [],
      exportArtifactContents: [],
    });
  });
});
