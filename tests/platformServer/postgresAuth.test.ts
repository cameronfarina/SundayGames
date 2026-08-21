import { FakePostgresAuthClient, FakePostgresClient, FakeTransactionalPostgresAuthClient, buildCurrentMockdLeagueSeason, createPlatformServer, expect, it, jsonFetch, leagueConfig, listen, mockRunner, normalizeSql, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("initializes normalized auth schema when auth is the only Postgres-backed repository", async () => {
    const postgresAuthClient = new FakeTransactionalPostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresAuthClient,
      initializePostgresSchema: true,
    });

    expect(platformServer.postgresAuthRepository).toBeDefined();
    expect(platformServer.postgresAccountOnboardingRepository).toBeDefined();
    expect(postgresAuthClient.statements.some(statement =>
      statement.includes("CREATE TABLE IF NOT EXISTS platform_schema_migrations")
    )).toBe(true);
    expect(postgresAuthClient.statements.some(statement =>
      normalizeSql(statement).startsWith("CREATE TABLE accounts")
    )).toBe(true);
    expect(postgresAuthClient.statements.some(statement =>
      normalizeSql(statement).startsWith("DELETE FROM account_onboarding_profiles")
    )).toBe(false);

    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "auth-only@example.com",
        password: "secure password1!",
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

  it("runs the onboarding rollout only when auth and league ownership share one database", async () => {
    const postgresClient = new FakeTransactionalPostgresAuthClient();
    await createListeningServer({
      postgresAuthClient: postgresClient,
      postgresLeagueSetupClient: postgresClient,
      initializePostgresSchema: true,
    });

    expect(postgresClient.statements.some(statement =>
      normalizeSql(statement).startsWith("DELETE FROM account_onboarding_profiles")
    )).toBe(true);
  });

  it("skips the onboarding rollout when auth and league ownership use different databases", async () => {
    const postgresAuthClient = new FakeTransactionalPostgresAuthClient();
    const postgresLeagueSetupClient = new FakeTransactionalPostgresAuthClient();
    await createListeningServer({
      postgresAuthClient,
      postgresLeagueSetupClient,
      initializePostgresSchema: true,
    });

    expect(postgresAuthClient.statements.some(statement =>
      normalizeSql(statement).startsWith("DELETE FROM account_onboarding_profiles")
    )).toBe(false);
    expect(postgresLeagueSetupClient.statements.some(statement =>
      normalizeSql(statement).startsWith("DELETE FROM account_onboarding_profiles")
    )).toBe(false);
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
        password: "legacy password1!",
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
        password: "secure password1!",
      }),
    });
    const login = await jsonFetch(loadedBaseUrl, "/sessions", {
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
