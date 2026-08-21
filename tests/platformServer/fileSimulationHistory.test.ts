import { InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, currentLeagueInitialRostersFor, expect, it, leagueConfig, loadCurrentPlayerCatalog, now, ownerOrder, propertyValue, readFile } from "./helpers/index.js";
import { completeBrowserSimulation } from "../platformHttp/support/browserSimulation.js";
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

    const launch = await platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });
    expect(launch).toMatchObject({ status: 202 });
    await completeBrowserSimulation({
      handle: platformServer.handler,
      launchResponse: launch,
      sessionToken: login.sessionToken,
      now,
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
