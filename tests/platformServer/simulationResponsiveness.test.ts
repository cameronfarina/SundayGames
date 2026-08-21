import {
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
  stringProperty,
} from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("keeps health checks responsive while the server prepares browser simulation input", async () => {
    const setupReadEntered = deferred();
    const releaseSetupRead = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadEntered.resolve();
        await releaseSetupRead.promise;
        return {
          seasonId: season.id,
          sourceVersion: "browser-simulation-preparation",
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: "browser-simulation-preparation-hash",
          updatedAt: now,
        };
      },
    });
    const account = await platformServer.app.createAccount({
      email: "simulation-health@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected simulation health fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Browser simulation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a claimed team.");
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

    const launch = platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });
    await setupReadEntered.promise;
    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseSetupRead.resolve();
    await expect(launch).resolves.toMatchObject({ status: 202 });
  });

  it("cancels an unfinished browser launch without saving a result", async () => {
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "browser-cancel-test",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "browser-cancel-test-hash",
        updatedAt: now,
      }),
    });
    const account = await platformServer.app.createAccount({
      email: "browser-cancel@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected browser cancellation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Browser cancellation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a claimed team.");
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
    const launch = await platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1 },
      now,
    });
    const historyId = stringProperty(launch.body, "historyId");

    await expect(platformServer.handler({
      method: "DELETE",
      path: `/season-simulations/${historyId}`,
      sessionToken: login.sessionToken,
      now,
    })).resolves.toMatchObject({ status: 204 });
    await expect(platformServer.app.getSimulationRun({
      actorSessionToken: login.sessionToken,
      runId: historyId,
      now,
    })).resolves.toMatchObject({ status: "canceled", result: undefined });
  });
});
