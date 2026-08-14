import { FakePostgresClient, InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, currentLeagueInitialRostersFor, deferred, expect, httpRequest, it, leagueConfig, loadCurrentPlayerCatalog, now, ownerOrder, runSeasonSimulations } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("keeps health checks responsive while a season simulation runs outside the snapshot queue", async () => {
    const setupReadEntered = deferred();
    const releaseSetupRead = deferred();
    const simulationEntered = deferred();
    const releaseSimulation = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadEntered.resolve();
        await releaseSetupRead.promise;
        return {
          seasonId: season.id,
          sourceVersion: "simulation-health-test",
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: "simulation-health-test-hash",
          updatedAt: now,
        };
      },
      seasonSimulationRunner: async input => {
        simulationEntered.resolve();
        await releaseSimulation.promise;
        return runSeasonSimulations(input);
      },
    });
    const account = await platformServer.app.createAccount({
      email: "simulation-health@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected simulation health fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a simulation health fixture team.");
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
    const queuedMutation = platformServer.handler({
      method: "POST",
      path: "/accounts",
      body: { email: "after-simulation-capture@example.com", password: "secure password" },
      now,
    });
    await expect(Promise.race([
      queuedMutation.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("still-queued"), 50)),
    ])).resolves.toBe("still-queued");
    releaseSetupRead.resolve();
    await expect(Promise.race([
      simulationEntered.promise.then(() => ({ entered: true })),
      simulation.then(response => ({ response })),
    ])).resolves.toEqual({ entered: true });

    await expect(Promise.race([
      queuedMutation,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Mutation remained blocked.")), 1_000)),
    ])).resolves.toMatchObject({ status: 201 });

    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseSimulation.resolve();
    await expect(simulation).resolves.toMatchObject({ status: 200 });
  });

  it("cancels a streamed season simulation on disconnect without saving a run", async () => {
    const simulationEntered = deferred();
    const simulationCanceled = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer, baseUrl } = await createListeningServer({
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "stream-cancel-test",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "stream-cancel-test-hash",
        updatedAt: now,
      }),
      seasonSimulationRunner: async (input, options) => {
        options?.onProgress?.({ completed: 1, total: input.runCount });
        simulationEntered.resolve();
        return await new Promise((_, reject) => {
          const cancel = (): void => {
            simulationCanceled.resolve();
            reject(new Error("Canceled by client disconnect."));
          };
          if (options?.signal?.aborted === true) cancel();
          else options?.signal?.addEventListener("abort", cancel, { once: true });
        });
      },
    });
    const account = await platformServer.app.createAccount({
      email: "stream-cancel@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected stream cancellation fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Stream cancellation league",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a stream cancellation fixture team.");
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

    const clientRequest = httpRequest(`${baseUrl}/season-simulations`, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
    });
    clientRequest.on("error", () => undefined);
    clientRequest.on("response", response => {
      response.once("data", () => response.destroy());
    });
    clientRequest.end(JSON.stringify({
      seasonId: season.id,
      count: 25,
      strategy: "Target Puka Nacua",
    }));

    await simulationEntered.promise;
    await expect(Promise.race([
      simulationCanceled.promise.then(() => undefined),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Simulation was not canceled.")), 250)),
    ])).resolves.toBeUndefined();
    await expect(platformServer.app.listSimulationRuns({
      actorSessionToken: login.sessionToken,
      seasonId: season.id,
      now,
    })).resolves.toEqual([]);
  });
});
