import { FakePostgresClient, InMemoryJobQueue, buildCurrentMockdLeagueSeason, dispatchNextPlatformJob, enqueueSimulationRunExecutionJob, expect, it, jsonFetch, leagueConfig, now, ownerOrder } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer }) => {
  it("runs cached job handlers against the reloaded Postgres runtime", async () => {
    const postgresClient = new FakePostgresClient();
    const { platformServer, baseUrl } = await createListeningServer({
      postgresClient,
    });
    const cachedHandlers = platformServer.jobHandlers;
    await platformServer.app.createAccount({ email: "owner11@example.com", password: "owner11 password!", now });
    const owner11 = await platformServer.app.login({ email: "owner11@example.com", password: "owner11 password!", now });
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
      seedPrefix: "cached-handler",
      idempotencyKey: "cached-handler",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    await platformServer.persist();

    if (postgresClient.row === undefined) {
      throw new Error("Expected setup mutation to persist a Postgres snapshot.");
    }
    postgresClient.row = {
      revision: 2,
      snapshot_json: postgresClient.row.snapshot_json,
    };
    const conflict = await jsonFetch(baseUrl, "/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "stale-local@example.com",
        password: "secure password1!",
      }),
    });
    expect(conflict.status).toBe(409);
    expect(platformServer.postgresStore?.loadedRevision).toBe(2);

    const repository = new InMemoryJobQueue();
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: owner11.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 6,
      seedPrefix: "cached-handler",
      now,
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: cachedHandlers,
    })).resolves.toBe(job);
    expect(postgresClient.row?.revision).toBe(3);
    await expect(platformServer.app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulation.id,
      now: new Date(now.getTime() + 2_000),
    })).resolves.toMatchObject({
      id: simulation.id,
      status: "completed",
      result: {
        runCount: 6,
      },
    });
  });
});
