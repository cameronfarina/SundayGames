import { InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, currentLeagueInitialRostersFor, dispatchNextPlatformJob, expect, it, leagueConfig, loadCurrentPlayerCatalog, now, ownerOrder, propertyValue, readFile } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, storePath }) => {
  it("persists completed season simulation history in the file-backed store", async () => {
    const dataFilePath = await storePath();
    const playerCatalog = await loadCurrentPlayerCatalog();
    const { platformServer } = await createListeningServer({
      dataFilePath,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => ({
        seasonId: season.id,
        sourceVersion: "season-simulation-persistence",
        playerCatalog,
        initialRosters: currentLeagueInitialRostersFor(season),
        contentHash: "season-simulation-persistence-hash",
        updatedAt: now,
      }),
    });
    const account = await platformServer.app.createAccount({
      email: "season-simulation-persistence@example.com",
      password: "secure password1!",
      now,
    });
    const login = await platformServer.app.login({
      email: account.email,
      password: "secure password1!",
      now,
    });
    if (login === null) throw new Error("Expected season simulation persistence fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Persistent simulations",
      setupStatus: "published",
    });
    const claimedTeam = season.teams[0];
    if (claimedTeam === undefined) throw new Error("Expected a season simulation persistence fixture team.");
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
    await platformServer.persist();

    await expect(platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    })).resolves.toMatchObject({ status: 202 });
    await dispatchNextPlatformJob({
      repository: platformServer.jobRepository,
      workerId: "file-simulation-history-worker",
      handlers: platformServer.jobHandlers,
    });
    await platformServer.persist();

    const saved: unknown = JSON.parse(await readFile(dataFilePath, "utf8"));
    expect(propertyValue(saved, "simulationRuns")).toEqual([
      expect.objectContaining({
        status: "completed",
        result: expect.objectContaining({
          seasonSimulation: expect.objectContaining({ runCount: 1 }),
        }),
      }),
    ]);
  });
});
