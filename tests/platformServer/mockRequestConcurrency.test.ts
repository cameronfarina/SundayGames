import {
  InMemoryMockDraftSessionRepository,
  type MockDraftSessionRepository,
} from "../../src/platform/mockSessions.js";
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
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

const gatedRepository = (): {
  repository: MockDraftSessionRepository;
  entered: ReturnType<typeof deferred>;
  release: ReturnType<typeof deferred>;
} => {
  const inner = new InMemoryMockDraftSessionRepository();
  const entered = deferred();
  const release = deferred();
  return {
    entered,
    release,
    repository: {
      createSession: async input => {
        entered.resolve();
        await release.promise;
        return inner.createSession(input);
      },
      assertCreationAllowed: input => inner.assertCreationAllowed(input),
      getSession: input => inner.getSession(input),
      listSessionsForOwner: input => inner.listSessionsForOwner(input),
      appendCommand: input => inner.appendCommand(input),
      findStoredCommandForRetry: input => inner.findStoredCommandForRetry(input),
      markCompleted: input => inner.markCompleted(input),
      resetSession: input => inner.resetSession(input),
      abandonSession: input => inner.abandonSession(input),
    },
  };
};

describePlatformServer(({ createListeningServer }) => {
  it("does not let normalized mock-session work block unrelated reads or live mutations", async () => {
    const mockGate = gatedRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient: new FakeTransactionalPlatformPostgresClient(),
      mockDraftSessionRepository: mockGate.repository,
    });
    const account = await platformServer.app.createAccount({
      email: "mock-concurrency@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected mock concurrency login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Mock concurrency league",
      setupStatus: "published",
    });
    const team = season.teams[0];
    if (team === undefined) throw new Error("Expected mock concurrency team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: team.ownerId,
        teamId: team.id,
      }],
      now,
    });
    await platformServer.app.createLiveDraftRoom({
      actorSessionToken: login.sessionToken,
      seasonId: season.id,
      roomId: "room_mock_concurrency",
      viewerPasswordHashRef: "viewer-password-hash",
      playerCatalog: [{ name: "Puka Nacua", position: "WR", expectedPrice: 73 }],
      initialRosters: completeInitialRostersFor(season, team.id),
      now,
    });
    await platformServer.persist();

    const mockCreate = jsonFetch(baseUrl, "/mock-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: JSON.stringify({
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: team.ownerId,
        teamId: team.id,
        draftMode: { format: "auction", mockCount: 1 },
      }),
    });
    await mockGate.entered.promise;

    const concurrentRequests = Promise.all([
      jsonFetch(baseUrl, "/session", {
        headers: { "x-session-token": login.sessionToken },
      }),
      jsonFetch(baseUrl, "/live-rooms/room_mock_concurrency/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-session-token": login.sessionToken,
        },
        body: JSON.stringify({
          expectedRevision: 1,
          idempotencyKey: "start:room_mock_concurrency",
        }),
      }),
    ]);
    const responsiveness = await Promise.race([
      concurrentRequests.then(responses => ({ status: "completed", responses })),
      new Promise<{ status: "blocked" }>(resolve =>
        setTimeout(() => resolve({ status: "blocked" }), 1_000)
      ),
    ]);

    mockGate.release.resolve();
    const [mockResponse] = await Promise.all([mockCreate, concurrentRequests]);
    expect(responsiveness).toMatchObject({
      status: "completed",
      responses: [
        { status: 200 },
        { status: 200, body: { room: { status: "live", revision: 2 } } },
      ],
    });
    expect(mockResponse.status).toBe(201);
  });
});
