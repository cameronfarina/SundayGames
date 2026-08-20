import { AsyncJobRepository, buildCurrentMockdLeagueSeason, expect, it, jsonFetch, leagueConfig, now, ownerOrder, propertyValue, readFile, stringProperty } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({ createListeningServer, storePath }) => {
  it("uses an injected async job repository for HTTP enqueue and reads without snapshot persistence", async () => {
    const dataFilePath = await storePath();
    const jobRepository = new AsyncJobRepository();
    const { platformServer, baseUrl } = await createListeningServer({
      dataFilePath,
      jobRepository,
    });
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
      seedPrefix: "external-queue",
      idempotencyKey: "external-queue",
      strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
      now,
    });
    await platformServer.persist();

    const enqueued = await jsonFetch(baseUrl, `/simulations/${simulation.id}/jobs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-token": owner11.sessionToken,
      },
      body: JSON.stringify({
        idempotencyKey: "external-queue-job",
        now: new Date(now.getTime() + 1_000).toISOString(),
      }),
    });
    const jobs = await jsonFetch(baseUrl, "/jobs", {
      headers: { "x-session-token": owner11.sessionToken },
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

    expect(platformServer.jobRepository).toBe(jobRepository);
    expect(enqueued).toMatchObject({
      status: 202,
      body: {
        job: {
          id: expect.stringMatching(/^job_/),
          userId: owner11.account.id,
          leagueId: season.leagueId,
          seasonId: season.id,
          status: "queued",
        },
      },
    });
    expect(jobs).toMatchObject({
      status: 200,
      body: {
        jobs: [
          {
            id: enqueuedJobId,
            status: "queued",
          },
        ],
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
    expect(jobRepository.inner.jobs()).toHaveLength(1);
    expect(jobRepository.inner.fetchForUser(enqueuedJobId, owner11.account.id)).toMatchObject({
      id: enqueuedJobId,
      status: "canceled",
    });

    const savedSnapshot: unknown = JSON.parse(await readFile(dataFilePath, "utf8"));
    expect(propertyValue(savedSnapshot, "jobs")).toEqual([]);
    expect(propertyValue(savedSnapshot, "simulationRuns")).toEqual([
      expect.objectContaining({
        id: simulation.id,
        status: "canceled",
      }),
    ]);
  });
});
