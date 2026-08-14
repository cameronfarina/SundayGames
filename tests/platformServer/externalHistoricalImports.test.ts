import { AsyncHistoricalImportRepository, FakePostgresClient, FakeTransactionalPostgresClient, InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, expect, it, join, jsonFetch, leagueConfig, loadCurrentPlayerCatalog, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("uses an external historical import repository for import HTTP routes without snapshot import writes", async () => {
    const postgresClient = new FakePostgresClient();
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const historicalImportRepository = new AsyncHistoricalImportRepository([season]);
    const { baseUrl } = await createListeningServer({
      postgresClient,
      historicalImportRepository,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "owner11@example.com",
        password: "secure password",
      }),
    });
    const accountId = stringProperty(propertyValue(created.body, "account"), "id");
    const sessionToken = sessionTokenFrom(login);
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");
    const memberships = [{
      userId: accountId,
      leagueId: season.leagueId,
      role: "owner",
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
    }];

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({ season, memberships }),
    });

    const preview = await jsonFetch(baseUrl, `/seasons/${season.id}/historical-imports/preview`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({
        sourceText: [
          "owner,player,position,price,year,keeper,acquisition",
          "Owner11,Ja'Marr Chase,WR,$61,2026,false,auction",
        ].join("\n"),
      }),
    });
    expect(preview).toMatchObject({
      status: 200,
      body: {
        batch: {
          status: "previewed",
        },
      },
    });
    const batchId = stringProperty(propertyValue(preview.body, "batch"), "id");
    const commit = await jsonFetch(baseUrl, `/historical-imports/${batchId}/commit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({ seasonId: season.id, seasonYear: 2026 }),
    });
    expect(commit).toMatchObject({
      status: 200,
      body: {
        batch: {
          id: batchId,
          status: "committed",
        },
      },
    });
    expect(historicalImportRepository.transactionCount).toBe(2);
    expect(postgresClient.row?.snapshot_json).toMatchObject({
      historicalImportBatches: [],
      historicalSaleRecords: [],
      pricingSnapshots: [expect.objectContaining({
        leagueId: season.leagueId,
        seasonYear: season.seasonYear,
        scenarioId: "expected",
      })],
    });
  });

  it("creates a Postgres historical import repository when a transactional import client is configured", async () => {
    const postgresHistoricalImportClient = new FakeTransactionalPostgresClient();
    const { platformServer } = await createListeningServer({ postgresHistoricalImportClient });

    expect(platformServer.postgresHistoricalImportRepository).toBeDefined();
    expect(platformServer.historicalImportRepository).toBe(platformServer.postgresHistoricalImportRepository);
  });
});
