import { FakeTransactionalPostgresClient, InMemoryPracticeShortlistRepository, buildCurrentMockdLeagueSeason, expect, it, jsonFetch, leagueConfig, loadCurrentPlayerCatalog, mkdir, now, ownerOrder, rm } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, storePath }) => {
  it("does not persist the unrelated snapshot after an external shortlist mutation", async () => {
    const dataFilePath = await storePath();
    const practiceShortlistRepository = new InMemoryPracticeShortlistRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      practiceShortlistRepository,
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
    });
    await platformServer.app.createAccount({
      email: "shortlist-storage@example.com",
      password: "secure password",
      now,
    });
    const login = await platformServer.app.login({
      email: "shortlist-storage@example.com",
      password: "secure password",
      now,
    });
    if (login === null) throw new Error("Expected shortlist fixture login.");
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, { setupStatus: "published" });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    await platformServer.app.registerLeagueSeason({
      actorSessionToken: login.sessionToken,
      season,
      memberships: [{
        userId: login.account.id,
        leagueId: season.leagueId,
        role: "owner",
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
      }],
      now,
    });
    await platformServer.persist();
    await rm(dataFilePath, { force: true });
    await mkdir(dataFilePath);

    await expect(jsonFetch(baseUrl, "/practice-shortlist", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-session-token": login.sessionToken,
      },
      body: JSON.stringify({
        seasonId: season.id,
        playerName: "Puka Nacua",
      }),
    })).resolves.toMatchObject({
      status: 200,
      body: { item: { playerName: "Puka Nacua" } },
    });
    await expect(practiceShortlistRepository.listForUserSeason(login.account.id, season.id)).resolves.toHaveLength(1);
  });

  it("creates a Postgres job queue when a transactional job client is configured", async () => {
    const postgresJobClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresJobClient });

    expect(platformServer.postgresJobQueue).toBeDefined();
    expect(platformServer.jobRepository).toBe(platformServer.postgresJobQueue);
  });

  it("creates a Postgres simulation repository when a transactional simulation client is configured", async () => {
    const postgresSimulationClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresSimulationClient });

    expect(platformServer.postgresSimulationRepository).toBeDefined();
    expect(platformServer.simulationRepository).toBe(platformServer.postgresSimulationRepository);
  });
});
