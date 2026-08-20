import {
  InMemoryPlatformStore,
  createLoggedInAccount,
  createPlatformApp,
  createPlatformHttpHandler,
  describe,
  expect,
  it,
  mockRunner,
  snakePlayerCatalog,
  snakeSeason,
  vi,
} from "../support/index.js";

describe("season simulation durable queueing", () => {
  it("queues batch compute instead of invoking the web process runner", async () => {
    const webProcessRunner = vi.fn(async () => {
      throw new Error("The web process must not run season simulations.");
    });
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      seasonSimulationRunner: webProcessRunner,
    });
    const handle = createPlatformHttpHandler(app, {
      liveDraftRoomSetupProvider: async () => ({
        playerCatalog: snakePlayerCatalog,
        initialRosters: [],
      }),
    });
    const owner = await createLoggedInAccount(handle, "queued-season-simulation@example.com");
    const season = snakeSeason();

    await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner.sessionToken,
      body: {
        season,
        memberships: [{
          userId: owner.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: season.teams[0]?.ownerId,
          teamId: season.teams[0]?.id,
        }],
      },
    });

    const response = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner.sessionToken,
      body: {
        seasonId: season.id,
        count: 2,
        strategy: "Draft Player 1 by round 1",
        requestId: "request-queued-season-1",
      },
    });

    expect(response).toMatchObject({
      status: 202,
      body: {
        historyId: expect.any(String),
        jobId: expect.any(String),
        status: "queued",
      },
    });
    expect(webProcessRunner).not.toHaveBeenCalled();
    expect(app.store.jobs.jobs()).toEqual([
      expect.objectContaining({
        kind: "season_simulation",
        status: "queued",
        inputJson: expect.objectContaining({
          type: "season-simulation-execution-v1",
          runCount: 2,
        }),
      }),
    ]);

    const retried = await handle({
      method: "POST",
      path: "/season-simulations",
      sessionToken: owner.sessionToken,
      body: {
        seasonId: season.id,
        count: 2,
        strategy: "Draft Player 1 by round 1",
        requestId: "request-queued-season-1",
      },
    });
    expect(retried.body).toEqual(response.body);
    expect(app.store.jobs.jobs()).toHaveLength(1);
    expect(app.store.simulations.runs()).toHaveLength(1);
  });
});
