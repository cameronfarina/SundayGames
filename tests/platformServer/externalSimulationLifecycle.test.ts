import { AsyncJobRepository, AsyncSimulationRepository, buildCurrentMockdLeagueSeason, createPlatformServer, dispatchNextPlatformJob, expect, it, jsonFetch, leagueConfig, mockRunner, now, ownerOrder, propertyValue, readFile, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, servers, storePath }) => {
  it("uses external job and simulation repositories for private simulation lifecycle without snapshot results", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const simulationRepository = new AsyncSimulationRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
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
    await platformServer.persist();

    const created = await jsonFetch(baseUrl, "/simulations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": owner11.sessionToken,
      },
      body: JSON.stringify({
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 6,
        seedPrefix: "external-sim",
        idempotencyKey: "external-sim",
        strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
        now: new Date(now.getTime() + 500).toISOString(),
      }),
    });
    const simulationId = stringProperty(propertyValue(created.body, "simulation"), "id");
    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulationId}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": owner11.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-sim-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const enqueuedJobId = stringProperty(propertyValue(enqueued.body, "job"), "id");
    const canceled = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/cancel`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": owner11.sessionToken,
      },
      body: JSON.stringify({
        now: new Date(now.getTime() + 2_000).toISOString(),
      }),
    });
    const rerun = await jsonFetch(baseUrl, `/jobs/${enqueuedJobId}/rerun`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": owner11.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "rerun-external-sim-job",
        now: new Date(now.getTime() + 3_000).toISOString(),
      }),
    });
    const rerunJobId = stringProperty(propertyValue(rerun.body, "job"), "id");

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(platformServer.simulationRepository).toBe(simulationRepository);
    expect(created).toMatchObject({
      status: 201,
      body: {
        simulation: {
          id: simulationId,
          status: "requested",
        },
      },
    });
    expect(canceled).toMatchObject({
      status: 200,
      body: {
        job: {
          id: enqueuedJobId,
          status: "canceled",
        },
      },
    });
    expect(await simulationRepository.fetchForUser(simulationId, owner11.account.id)).toMatchObject({
      id: simulationId,
      status: "requested",
      result: undefined,
    });

    await expect(dispatchNextPlatformJob({
      repository: jobRepository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 4_000),
      handlers: platformServer.jobHandlers,
    })).resolves.toMatchObject({
      id: rerunJobId,
      status: "completed",
    });
    expect(await simulationRepository.fetchForUser(simulationId, owner11.account.id)).toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
        forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
      },
    });

    await platformServer.close();
    const loadedServer = await createPlatformServer({
      dataFilePath,
      jobRepository,
      simulationRepository,
      simulationRunner: mockRunner,
      now: () => now,
    });
    servers.push(loadedServer);

    await expect(loadedServer.app.getSimulationRun({
      actorSessionToken: owner11.sessionToken,
      runId: simulationId,
      now: new Date(now.getTime() + 5_000),
    })).resolves.toMatchObject({
      id: simulationId,
      status: "completed",
      result: {
        runCount: 6,
      },
    });

    const savedSnapshot: unknown = JSON.parse(await readFile(dataFilePath, "utf8"));
    expect(propertyValue(savedSnapshot, "jobs")).toEqual([]);
    expect(propertyValue(savedSnapshot, "simulationRuns")).toEqual([]);
  });
});
