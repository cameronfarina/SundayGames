import { FakePostgresAuthClient, FakePostgresClient, buildCurrentMockdLeagueSeason, createPlatformServer, expect, it, jsonFetch, leagueConfig, listen, mockRunner, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers }) => {
  it("persists account onboarding with Postgres auth instead of the snapshot", async () => {
    const postgresClient = new FakePostgresClient();
    const postgresAuthClient = new FakePostgresAuthClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      postgresAuthClient,
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const accountId = stringProperty(propertyValue(created.body, "account"), "id");
    const sessionToken = sessionTokenFrom(login);
    for (const body of [
      { accountId, action: "set_intent", intent: "practice" },
      { accountId, action: "set_providers", providers: ["sleeper"] },
      { accountId, action: "complete" },
    ]) {
      const saved = await jsonFetch(baseUrl, "/account-onboarding", {
        method: "PUT",
        headers: { "content-type": "application/json", "x-session-token": sessionToken },
        body: JSON.stringify(body),
      });
      expect(saved.status).toBe(200);
    }

    expect(platformServer.authRepository).toBe(platformServer.postgresAuthRepository);
    expect(platformServer.accountOnboardingRepository)
      .toBe(platformServer.postgresAccountOnboardingRepository);
    expect(postgresClient.row).toBeUndefined();
    expect(postgresAuthClient.accountOnboarding.get(accountId)?.completed_at).toEqual(now);
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
        memberships: [{
          userId: accountId,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      }),
    });
    expect(registered.status).toBe(200);
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      auth: { accountCredentials: [], sessions: [] },
      memberships: [expect.objectContaining({ userId: accountId, leagueId: season.leagueId })],
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
    const loadedSession = await jsonFetch(loadedBaseUrl, "/session", {
      headers: { "x-session-token": sessionToken },
    });
    expect(await jsonFetch(loadedBaseUrl, `/seasons/${season.id}`, {
      headers: { "x-session-token": sessionToken },
    })).toMatchObject({ status: 200, body: { season: { id: season.id } } });
    expect(loadedServer.store.snapshot().auth).toEqual({ accountCredentials: [], sessions: [] });
    expect(loadedSession).toMatchObject({
      status: 200,
      body: { onboarding: { providers: ["sleeper"], stage: "complete" } },
    });
  });
});
