import { InMemoryLeagueConnectionRepository } from "../../src/platform/leagueConnections.js";
import {
  FakeTransactionalPlatformPostgresClient,
  buildCurrentMockdLeagueSeason,
  completeInitialRostersFor,
  deferred,
  expect,
  it,
  jsonFetch,
  leagueConfig,
  now,
  ownerOrder,
  propertyValue,
  sessionTokenFrom,
  stringProperty,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

const quickResponseDeadlineMs = 250;
const externalRequestDeadlineMs = 1_000;
const completedResponse = <T>(response: T): { status: "completed"; response: T } => ({
  status: "completed",
  response,
});
const completedResponses = <T>(responses: T): { status: "completed"; responses: T } => ({
  status: "completed",
  responses,
});

describePlatformServer(({ createListeningServer }) => {
  it("allows independent reads to finish concurrently", async () => {
    const readinessEntered = deferred();
    const releaseReadiness = deferred();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakeTransactionalPlatformPostgresClient(),
      readinessProbe: async () => {
        readinessEntered.resolve();
        await releaseReadiness.promise;
        return true;
      },
    });

    const readiness = platformServer.handler({ method: "GET", path: "/readyz", now });
    await readinessEntered.promise;
    const health = platformServer.handler({ method: "GET", path: "/healthz", now });
    const responsiveness = await Promise.race([
      health.then(completedResponse),
      new Promise<{ status: "blocked" }>(resolve =>
        setTimeout(() => resolve({ status: "blocked" }), quickResponseDeadlineMs)
      ),
    ]);

    releaseReadiness.resolve();
    await expect(readiness).resolves.toMatchObject({ status: 200 });
    expect(responsiveness).toMatchObject({ status: "completed", response: { status: 200 } });
  });

  it("waits for an in-flight read before changing snapshot-backed state", async () => {
    const readinessEntered = deferred();
    const releaseReadiness = deferred();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakeTransactionalPlatformPostgresClient(),
      readinessProbe: async () => {
        readinessEntered.resolve();
        await releaseReadiness.promise;
        return true;
      },
    });

    const readiness = platformServer.handler({ method: "GET", path: "/readyz", now });
    await readinessEntered.promise;
    const accountCreate = platformServer.handler({
      method: "POST",
      path: "/accounts",
      body: { email: "write-after-read@example.com", password: "secure password1!" },
      now,
    });
    const writeState = await Promise.race([
      accountCreate.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), quickResponseDeadlineMs)),
    ]);

    releaseReadiness.resolve();
    await expect(Promise.all([readiness, accountCreate])).resolves.toMatchObject([
      { status: 200 },
      { status: 201 },
    ]);
    expect(writeState).toBe("blocked");
  });

  it("keeps unrelated account and live-draft requests responsive during league sync", async () => {
    const syncFetchEntered = deferred();
    const releaseSyncFetch = deferred();
    const postgresClient = new FakeTransactionalPlatformPostgresClient();
    const { baseUrl } = await createListeningServer({
      postgresClient,
      leagueConnectionRepository: new InMemoryLeagueConnectionRepository(),
      leagueSyncFetch: async () => {
        syncFetchEntered.resolve();
        await releaseSyncFetch.promise;
        return new Response("provider unavailable", { status: 503 });
      },
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
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Concurrent requests league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a team fixture.");

    await jsonFetch(baseUrl, "/seasons", {
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
          ownerId: claimedTeam.ownerId,
          teamId: claimedTeam.id,
        }],
      }),
    });
    await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_request_concurrency",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
        initialRosters: completeInitialRostersFor(season, claimedTeam.id),
      }),
    });

    const sync = jsonFetch(baseUrl, "/league-connections", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        provider: "sleeper",
        providerLeagueId: "289646328504385536",
        season: "2018",
        displayName: "Sleeper Friends League",
      }),
    });
    await syncFetchEntered.promise;

    const sessionRead = jsonFetch(baseUrl, "/session", {
      headers: { "x-session-token": sessionToken },
    });
    const concurrentLogin = jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const draftStart = jsonFetch(baseUrl, "/live-rooms/room_request_concurrency/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        expectedRevision: 1,
        idempotencyKey: "start:room_request_concurrency",
      }),
    });
    const concurrentRequests = Promise.all([sessionRead, concurrentLogin, draftStart]);
    const responsiveness = await Promise.race([
      concurrentRequests.then(completedResponses),
      new Promise<{ status: "blocked" }>(resolve =>
        setTimeout(() => resolve({ status: "blocked" }), externalRequestDeadlineMs)
      ),
    ]);

    releaseSyncFetch.resolve();
    const [syncResponse] = await Promise.all([sync, concurrentRequests]);

    expect(responsiveness).toMatchObject({
      status: "completed",
      responses: [
        { status: 200 },
        { status: 200 },
        { status: 200, body: { room: { status: "live", revision: 2 } } },
      ],
    });
    expect(syncResponse.status).toBe(201);
  });

});
