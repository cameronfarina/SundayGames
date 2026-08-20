import {
  FakePostgresClient,
  InMemoryLiveDraftRoomSetupRepository,
  buildCurrentMockdLeagueSeason,
  currentLeagueInitialRostersFor,
  dispatchNextPlatformJob,
  expect,
  it,
  leagueConfig,
  loadCurrentPlayerCatalog,
  now,
  ownerOrder,
  runSeasonSimulations,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("caps an account at one active durable season simulation", async () => {
    const playerCatalog = await loadCurrentPlayerCatalog();
    const executedStrategies: string[] = [];
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "durable-concurrent-simulation",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "durable-concurrent-simulation-hash",
        updatedAt: now,
      }),
      seasonSimulationRunner: async input => {
        executedStrategies.push(input.strategyInput ?? "");
        return runSeasonSimulations(input);
      },
    });
    const account = await platformServer.app.createAccount({
      email: "concurrent-simulations@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected concurrent simulation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Concurrent simulation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a concurrent simulation fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: claimedTeam.ownerId,
        teamId: claimedTeam.id,
      }],
      now,
    });
    const request = (strategy: string) => platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy },
      now,
    });

    const responses = await Promise.all([
      request("Target Puka Nacua"),
      request("Target Jahmyr Gibbs"),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([202, 429]);
    expect(responses).toContainEqual(expect.objectContaining({
      status: 429,
      body: { error: expect.objectContaining({ code: "simulation_account_queue_full" }) },
    }));

    await dispatchNextPlatformJob({
      repository: platformServer.jobRepository,
      workerId: "durable-concurrent-simulation-worker",
      handlers: platformServer.jobHandlers,
    });

    expect(executedStrategies).toHaveLength(1);
    expect(["Target Jahmyr Gibbs", "Target Puka Nacua"]).toContain(executedStrategies[0]);
  });
});
