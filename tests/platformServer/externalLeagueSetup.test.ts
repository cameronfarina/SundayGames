import { AsyncLeagueSetupRepository, FakePostgresClient, FakeTransactionalPostgresClient, buildCurrentMockdLeagueSeason, expect, it, jsonFetch, leagueConfig, listen, mockRunner, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty, type RegisterLeagueSeasonRepositoryInput, createPlatformServer } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("uses an external league setup repository for season HTTP routes without snapshot setup writes", async () => {
    const postgresClient = new FakePostgresClient();
    const leagueSetupRepository = new AsyncLeagueSetupRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      leagueSetupRepository,
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
    const memberships: RegisterLeagueSeasonRepositoryInput["memberships"] = [
      {
        userId: accountId,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      },
    ];

    const registered = await jsonFetch(baseUrl, `/seasons/${season.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships,
      }),
    });

    expect(registered.status).toBe(200);
    expect(platformServer.leagueSetupRepository).toBe(leagueSetupRepository);
    expect(leagueSetupRepository.registerInputs.at(-1)).toMatchObject({
      createdByUserId: accountId,
      season: {
        id: season.id,
        leagueId: season.leagueId,
      },
      memberships,
    });
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      leagueSeasons: [],
      memberships: [],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      leagueSetupRepository,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    const loadedSeason = await jsonFetch(loadedBaseUrl, `/seasons/${season.id}`, {
      headers: { "x-session-token": sessionToken },
    });

    expect(loadedSeason).toMatchObject({
      status: 200,
      body: {
        season: {
          id: season.id,
          leagueId: season.leagueId,
        },
      },
    });
  });

  it("creates a Postgres league setup repository when a transactional setup client is configured", async () => {
    const postgresLeagueSetupClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresLeagueSetupClient });

    expect(platformServer.postgresLeagueSetupRepository).toBeDefined();
    expect(platformServer.leagueSetupRepository).toBe(platformServer.postgresLeagueSetupRepository);
  });
});
