import { FakePostgresClient, InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, currentLeagueInitialRostersFor, deferred, expect, it, leagueConfig, loadCurrentPlayerCatalog, now, ownerOrder } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("keeps concurrent simulation input handoffs request-scoped", async () => {
    const firstSetupReadEntered = deferred();
    const releaseFirstSetupRead = deferred();
    const playerCatalog = await loadCurrentPlayerCatalog();
    let setupReadCount = 0;
    const { platformServer } = await createListeningServer({
      postgresClient: new FakePostgresClient(),
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      liveDraftRoomSetupProvider: async season => {
        setupReadCount += 1;
        if (setupReadCount === 1) {
          firstSetupReadEntered.resolve();
          await releaseFirstSetupRead.promise;
        }
        return {
          seasonId: season.id,
          sourceVersion: `concurrent-simulation-${setupReadCount}`,
          playerCatalog,
          initialRosters: currentLeagueInitialRostersFor(season),
          contentHash: `concurrent-simulation-hash-${setupReadCount}`,
          updatedAt: now,
        };
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
    const request = () => platformServer.handler({
      method: "POST",
      path: "/season-simulations",
      sessionToken: login.sessionToken,
      body: { seasonId: season.id, count: 1, strategy: "Target Puka Nacua" },
      now,
    });

    const first = request();
    await firstSetupReadEntered.promise;
    const second = request();
    releaseFirstSetupRead.resolve();
    await expect(Promise.all([first, second])).resolves.toMatchObject([
      { status: 202 },
      { status: 202 },
    ]);
  });
});
