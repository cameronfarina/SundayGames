import { FakeTransactionalPlatformPostgresClient, InMemoryLiveDraftRoomSetupRepository, buildCurrentMockdLeagueSeason, deferred, expect, it, join, jsonFetch, leagueConfig, now, ownerOrder, propertyValue, sessionTokenFrom, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("restores process-local pricing when historical room synchronization rolls back", async () => {
    const postgresClient = new FakeTransactionalPlatformPostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
      liveDraftRoomSetupRepository: new InMemoryLiveDraftRoomSetupRepository(),
    });
    const created = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner11@example.com", password: "secure password1!" }),
    });
    const accountId = stringProperty(propertyValue(created.body, "account"), "id");
    const sessionToken = sessionTokenFrom(login);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "Rollback League",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await jsonFetch(baseUrl, "/seasons", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        season,
        memberships: [{
          userId: accountId,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        }],
      }),
    });
    const roomCreated = await jsonFetch(baseUrl, "/live-rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
        "x-mockd-provisioning-token": "test-provisioning-token",
      },
      body: JSON.stringify({
        seasonId: season.id,
        roomId: "room_history_rollback",
        viewerPasswordHashRef: "viewer-password-hash",
        playerCatalog: [
          { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
          { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
        ],
      }),
    });
    expect(roomCreated.status).toBe(201);
    const preview = await platformServer.app.previewHistoricalImportSource({
      actorSessionToken: sessionToken,
      leagueId: season.leagueId,
      seasonYear: 2025,
      currentSeasonId: season.id,
      sourceText: [
        "owner,player,position,price,year,player id,keeper,acquisition",
        "Owner11,Puka Nacua,WR,$61,2025,player-puka,false,auction",
      ].join("\n"),
      now,
    });
    await platformServer.persist();
    const batchId = preview.batch.id;
    postgresClient.failNextDraftRoomRevisionUpdate = true;
    const rollbackStarted = deferred();
    const releaseRollback = deferred();
    postgresClient.rollbackGate = releaseRollback.promise;
    postgresClient.onRollbackStarted = rollbackStarted.resolve;

    const failedCommitRequest = jsonFetch(baseUrl, `/historical-imports/${batchId}/commit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": sessionToken,
      },
      body: JSON.stringify({ seasonId: season.id, seasonYear: 2025 }),
    });
    await rollbackStarted.promise;
    const pricingAfterRollbackRequest = jsonFetch(baseUrl, `/seasons/${season.id}/pricing-snapshots`, {
      headers: { "x-session-token": sessionToken },
    });
    const concurrentReadState = await Promise.race([
      pricingAfterRollbackRequest.then(() => "resolved"),
      new Promise(resolve => setTimeout(() => resolve("blocked"), 50)),
    ]);
    releaseRollback.resolve();
    const [failedCommit, pricingAfterRollback] = await Promise.all([
      failedCommitRequest,
      pricingAfterRollbackRequest,
    ]);
    const roomAfterRollback = await jsonFetch(baseUrl, "/live-rooms/room_history_rollback", {
      headers: { "x-session-token": sessionToken },
    });

    expect(preview).toMatchObject({ batch: { status: "previewed" } });
    expect(concurrentReadState).toBe("blocked");
    expect(failedCommit.status).toBe(500);
    expect(pricingAfterRollback).toMatchObject({ status: 200, body: { pricingSnapshots: [] } });
    expect(roomAfterRollback).toMatchObject({
      status: 200,
      body: { room: { revision: 1, salesLog: [] } },
    });
    expect(propertyValue(postgresClient.row?.snapshot_json, "pricingSnapshots")).toEqual([]);
  });
});
