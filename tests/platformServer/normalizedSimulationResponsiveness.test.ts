import {
  AsyncSimulationRepository,
  FakePostgresClient,
  InMemoryLiveDraftRoomSetupRepository,
  buildCurrentMockdLeagueSeason,
  currentLeagueInitialRostersFor,
  deferred,
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
  it("keeps unrelated reads and writes responsive during normalized simulation preparation", async () => {
    const setupReadEntered = deferred();
    const releaseSetupRead = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      simulationRepository: new AsyncSimulationRepository(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadEntered.resolve();
        await releaseSetupRead.promise;
        return {
          seasonId: season.id,
          sourceVersion: "normalized-simulation-preparation",
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: "normalized-simulation-preparation-hash",
          updatedAt: now,
        };
      },
      seasonSimulationRunner: async input => runSeasonSimulations(input),
    });
    const account = await platformServer.app.createAccount({
      email: "normalized-simulation@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected normalized simulation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Normalized simulation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a normalized simulation fixture team.");
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

    const simulation = platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });
    await setupReadEntered.promise;
    const unrelated = Promise.all([
      platformServer.handler({
        method: "GET",
        path: "/session",
        sessionToken: login.sessionToken,
        now,
      }),
      platformServer.handler({
        method: "POST",
        path: "/accounts",
        body: { email: "during-normalized-simulation@example.com", password: "secure password1!" },
        now,
      }),
    ]);

    await expect(Promise.race([
      unrelated.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), 1_000)),
    ])).resolves.toBe("completed");

    releaseSetupRead.resolve();
    await expect(Promise.all([simulation, unrelated])).resolves.toMatchObject([
      { status: 200 },
      [{ status: 200 }, { status: 201 }],
    ]);
  });
});
