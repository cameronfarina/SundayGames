import {
  FakePostgresClient,
  InMemoryLiveDraftRoomSetupRepository,
  buildCurrentMockdLeagueSeason,
  currentLeagueInitialRostersFor,
  deferred,
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
import type { PlatformServer } from "../../src/platform/platformServer.js";

const registerSimulationOwner = async (
  platformServer: PlatformServer,
  email: string,
) => {
  const account = await platformServer.app.createAccount({
    email,
    password: "secure password1!",
    now,
  });
  const login = await platformServer.app.login({
    email,
    password: "secure password1!",
    now,
  });
  if (login === null) throw new Error("Expected simulation fixture login.");
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Durable simulation league",
    setupStatus: "published",
  });
  const claimedTeam = season.teams[0];
  if (claimedTeam === undefined) throw new Error("Expected a simulation fixture team.");
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
  return { account, login, season };
};

const isAsyncTextStream = (value: unknown): value is AsyncIterable<string> =>
  typeof value === "object"
  && value !== null
  && Symbol.asyncIterator in value
  && typeof value[Symbol.asyncIterator] === "function";

const asyncTextStreamFrom = (value: unknown): AsyncIterable<string> => {
  if (!isAsyncTextStream(value)) {
    throw new Error("Expected a season simulation event stream.");
  }
  return value;
};

describePlatformServer(({ createListeningServer }) => {
  it("keeps health checks responsive while the durable worker runs a season simulation", async () => {
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
    const { login, season } = await registerSimulationOwner(
      platformServer,
      "simulation-health@example.com",
    );

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
      body: { email: "after-simulation-capture@example.com", password: "secure password1!" },
      now,
    });
    await expect(Promise.race([
      queuedMutation.then(() => "completed"),
      new Promise(resolve => setTimeout(() => resolve("still-queued"), 50)),
    ])).resolves.toBe("still-queued");
    releaseSetupRead.resolve();
    await expect(simulation).resolves.toMatchObject({ status: 202, body: { status: "queued" } });
    await expect(queuedMutation).resolves.toMatchObject({ status: 201 });

    const worker = dispatchNextPlatformJob({
      repository: platformServer.jobRepository,
      workerId: "simulation-health-worker",
      handlers: platformServer.jobHandlers,
    });
    await simulationEntered.promise;
    await expect(Promise.race([
      platformServer.handler({ method: "GET", path: "/healthz", now }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Health check was blocked.")), 100)),
    ])).resolves.toMatchObject({ status: 200 });
    releaseSimulation.resolve();
    await expect(worker).resolves.toMatchObject({ status: "completed" });
  });

  it("keeps a queued season simulation durable when its stream disconnects", async () => {
    const playerCatalog = await loadCurrentPlayerCatalog();
    const simulationEntered = deferred();
    const { platformServer } = await createListeningServer({
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "stream-disconnect-test",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "stream-disconnect-test-hash",
        updatedAt: now,
      }),
      seasonSimulationRunner: async input => {
        simulationEntered.resolve();
        return runSeasonSimulations(input);
      },
    });
    const { login, season } = await registerSimulationOwner(
      platformServer,
      "stream-disconnect@example.com",
    );
    const abortController = new AbortController();
    const response = await platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      headers: { accept: "text/event-stream" },
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      signal: abortController.signal,
      now,
    });
    const stream = asyncTextStreamFrom(response.body);
    const iterator = stream[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: expect.stringContaining('event: queued'),
    });
    await expect(iterator.next()).resolves.toMatchObject({
      value: expect.stringContaining('event: progress\ndata: {"completed":0,"total":1}'),
    });
    abortController.abort();
    await expect(iterator.next()).resolves.toMatchObject({ done: true });

    const worker = dispatchNextPlatformJob({
      repository: platformServer.jobRepository,
      workerId: "stream-disconnect-worker",
      handlers: platformServer.jobHandlers,
    });
    await simulationEntered.promise;
    await expect(worker).resolves.toMatchObject({ status: "completed" });
    await expect(platformServer.app.listSimulationRuns({
      actorSessionToken: login.sessionToken,
      seasonId: season.id,
      now,
    })).resolves.toMatchObject([{ status: "completed" }]);
  });
});
