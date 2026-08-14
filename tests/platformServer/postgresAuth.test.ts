import { FakePostgresAuthClient, FakePostgresClient, FakeTransactionalPostgresAuthClient, buildCurrentMockdLeagueSeason, createPlatformServer, expect, it, jsonFetch, leagueConfig, listen, mockRunner, normalizeSql, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("uses Postgres auth for account and session HTTP routes without snapshot auth writes", async () => {
    const postgresClient = new FakePostgresClient();
    const postgresAuthClient = new FakePostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      postgresAuthClient,
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

    expect(platformServer.authRepository).toBe(platformServer.postgresAuthRepository);
    expect(postgresClient.row).toBeUndefined();
    expect(postgresAuthClient.accounts.get(accountId)).toMatchObject({
      email: "owner11@example.com",
      email_normalized: "owner11@example.com",
      password_hash: expect.stringMatching(/^scrypt\$/),
    });
    expect(JSON.stringify([...postgresAuthClient.sessions.values()])).not.toContain(sessionToken);

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    const registered = await jsonFetch(baseUrl, "/seasons", {
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

    expect(registered.status).toBe(200);
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      schemaVersion: 1,
      auth: {
        accountCredentials: [],
        sessions: [],
      },
      memberships: [
        expect.objectContaining({
          userId: accountId,
          leagueId: season.leagueId,
        }),
      ],
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      postgresClient,
      postgresAuthClient,
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
    expect(loadedServer.store.snapshot().auth).toEqual({
      accountCredentials: [],
      sessions: [],
    });
  });

  it("initializes normalized auth schema when auth is the only Postgres-backed repository", async () => {
    const postgresAuthClient = new FakeTransactionalPostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresAuthClient,
      initializePostgresSchema: true,
    });

    expect(platformServer.postgresAuthRepository).toBeDefined();
    expect(postgresAuthClient.statements.some(statement =>
      statement.includes("CREATE TABLE IF NOT EXISTS platform_schema_migrations")
    )).toBe(true);
    expect(postgresAuthClient.statements.some(statement =>
      normalizeSql(statement).startsWith("CREATE TABLE accounts")
    )).toBe(true);

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-only@example.com",
        password: "secure password",
      }),
    });

    expect(created).toMatchObject({
      status: 201,
      body: {
        account: {
          email: "auth-only@example.com",
        },
      },
    });
    expect(postgresAuthClient.accounts.size).toBe(1);
  });

  it("scrubs stale snapshot auth when Postgres auth owns runtime accounts and sessions", async () => {
    const postgresClient = new FakePostgresClient();
    const legacyServer = await createPlatformServer({
      postgresClient,
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
    });
    servers.push(legacyServer);
    const legacyBaseUrl = await listen(legacyServer);

    await jsonFetch(legacyBaseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "legacy@example.com",
        password: "legacy password",
      }),
    });
    expect(JSON.stringify(postgresClient.row?.snapshot_json)).toContain("legacy@example.com");

    await legacyServer.close();
    const postgresAuthClient = new FakePostgresAuthClient();
    const loadedServer = await createPlatformServer({
      postgresClient,
      postgresAuthClient,
      simulationRunner: mockRunner,
      now: () => now,
      allowPublicSignup: true,
      provisioningToken: "test-provisioning-token",
    });
    servers.push(loadedServer);
    const loadedBaseUrl = await listen(loadedServer);

    expect(loadedServer.store.snapshot().auth).toEqual({
      accountCredentials: [],
      sessions: [],
    });

    const created = await jsonFetch(loadedBaseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
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

    await jsonFetch(loadedBaseUrl, "/seasons", {
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

    expect(postgresClient.row?.snapshot_json).toMatchObject({
      auth: {
        accountCredentials: [],
        sessions: [],
      },
    });
    expect(JSON.stringify(postgresClient.row?.snapshot_json)).not.toContain("legacy@example.com");
  });
});
