import { FakePostgresClient, InMemoryJobQueue, buildCurrentMockdLeagueSeason, deferred, dispatchNextPlatformJob, enqueueSimulationRunExecutionJob, expect, it, jsonFetch, leagueConfig, now, ownerOrder } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("serializes Postgres snapshot-backed worker mutations with HTTP mutations", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    await platformServer.app.createAccount({ email: "owner11@example.com", password: "owner11 password", now });
    const owner11 = await platformServer.app.login({ email: "owner11@example.com", password: "owner11 password", now });
    if (owner11 === null) throw new Error("Expected login.");

    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 100001",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Owner11");
    if (camTeam === undefined) throw new Error("Expected Owner11 fixture team.");

    await platformServer.app.registerLeagueSeason({
      actorSessionToken: owner11.sessionToken,
      season,
      memberships: [
        {
          userId: owner11.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await platformServer.app.createSimulationRun({
      actorSessionToken: owner11.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 6,
      seedPrefix: "postgres-worker",
      idempotencyKey: "postgres-worker",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    await platformServer.persist();
    expect(postgresClient.row?.revision).toBe(1);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "postgres-worker",
      now,
    });
    const workerInsertEntered = deferred();
    const releaseWorkerInsert = deferred();
    postgresClient.nextInsertGate = {
      entered: workerInsertEntered.resolve,
      release: releaseWorkerInsert.promise,
    };
    const workerDispatch = dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: platformServer.jobHandlers,
    });

    await workerInsertEntered.promise;
    const accountCreate = jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });

    releaseWorkerInsert.resolve();

    await expect(workerDispatch).resolves.toBe(job);
    await expect(accountCreate).resolves.toMatchObject({ status: 201 });
    expect(job.status).toBe("completed");
    expect(postgresClient.row?.revision).toBe(3);

    const login = await jsonFetch(baseUrl, "/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "queued-http@example.com",
        password: "secure password",
      }),
    });
    expect(login.status).toBe(200);
  });
});
