import { expect, expectBodyRecord, expectString, isRecord, now } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingSimulationJobs = async ({ handle, owner11, owner04, season, camTeam, sethTeam }: RoutingContext): Promise<string> => {
    const createdSimulation = await handle({
      method: "POST",
      path: "/simulations",
      sessionToken: owner11.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: camTeam.ownerId,
        teamId: camTeam.id,
        count: 25,
        seedPrefix: "owner11-puka-plan",
        idempotencyKey: "owner11-puka-plan",
        strategy: {
          hardLocks: [
            { playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" },
          ],
        },
        now,
      },
    });
    const simulation = expectBodyRecord(createdSimulation.body).simulation;
    if (!isRecord(simulation)) throw new Error("Expected simulation response.");
    const simulationId = expectString(simulation.id);

    expect(createdSimulation.status).toBe(201);

    const enqueuedSimulationJob = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/jobs`,
      sessionToken: owner11.sessionToken,
      body: {
        idempotencyKey: "job:owner11-puka-plan",
        now: new Date(now.getTime() + 750).toISOString(),
      },
    });

    expect(enqueuedSimulationJob.status).toBe(202);
    expect(enqueuedSimulationJob.body).toMatchObject({
      job: expect.objectContaining({
        kind: "simulation",
        status: "queued",
      }),
    });

    const listedJobs = await handle({
      method: "GET",
      path: "/jobs",
      sessionToken: owner11.sessionToken,
    });

    expect(listedJobs.body).toMatchObject({
      jobs: [expect.objectContaining({ kind: "simulation" })],
    });
    const enqueuedJob = expectBodyRecord(enqueuedSimulationJob.body).job;
    if (!isRecord(enqueuedJob)) throw new Error("Expected job response.");
    const enqueuedJobId = expectString(enqueuedJob.id);

    const canceledJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/cancel`,
      sessionToken: owner11.sessionToken,
      body: {
        now: new Date(now.getTime() + 900).toISOString(),
      },
    });

    expect(canceledJob).toMatchObject({
      status: 200,
      body: {
        job: expect.objectContaining({
          id: enqueuedJobId,
          status: "canceled",
        }),
      },
    });
    const fetchedCanceledSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: owner11.sessionToken,
    });

    expect(fetchedCanceledSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "canceled",
        result: undefined,
      }),
    });

    const rerunJob = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/rerun`,
      sessionToken: owner11.sessionToken,
      body: {
        idempotencyKey: "rerun-owner11-puka-plan",
        now: new Date(now.getTime() + 950).toISOString(),
      },
    });
    const rerunJobBody = expectBodyRecord(rerunJob.body);
    const rerunJobRecord = expectBodyRecord(rerunJobBody.job);
    const rerunJobId = expectString(rerunJobRecord.id);

    expect(rerunJob).toMatchObject({
      status: 202,
      body: {
        job: expect.objectContaining({
          id: rerunJobId,
          status: "queued",
          idempotencyKey: `simulation-rerun:${simulationId}`,
        }),
      },
    });
    expect(rerunJobId).not.toBe(enqueuedJobId);

    const duplicateRerun = await handle({
      method: "POST",
      path: `/jobs/${enqueuedJobId}/rerun`,
      sessionToken: owner11.sessionToken,
      body: {
        idempotencyKey: "different-client-key",
        now: new Date(now.getTime() + 960).toISOString(),
      },
    });
    expect(duplicateRerun).toMatchObject({
      status: 409,
      body: {
        error: {
          code: "job_already_active",
          message: "A rerun is already queued or running for this simulation.",
        },
      },
    });

    const listedSimulations = await handle({
      method: "GET",
      path: "/simulations",
      sessionToken: owner11.sessionToken,
    });

    expect(listedSimulations.body).toMatchObject({
      simulations: [
        expect.objectContaining({ id: simulationId, status: "requested" }),
      ],
    });

    const fetchedSimulation = await handle({
      method: "GET",
      path: `/simulations/${simulationId}`,
      sessionToken: owner11.sessionToken,
    });

    expect(fetchedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({ id: simulationId, status: "requested" }),
    });

    const executedSimulation = await handle({
      method: "POST",
      path: `/simulations/${simulationId}/execute`,
      sessionToken: owner11.sessionToken,
      body: {
        now: new Date(now.getTime() + 1_000).toISOString(),
      },
    });

    expect(executedSimulation.body).toMatchObject({
      simulation: expect.objectContaining({
        id: simulationId,
        status: "completed",
        result: expect.objectContaining({ runCount: 25 }),
      }),
    });

    const sethSimulation = await handle({
      method: "POST",
      path: "/simulations",
      sessionToken: owner04.sessionToken,
      body: {
        leagueId: season.leagueId,
        seasonId: season.id,
        ownerId: sethTeam.ownerId,
        teamId: sethTeam.id,
        count: 5,
        seedPrefix: "owner04-private-run",
        idempotencyKey: "owner04-private-run",
        strategy: { hardLocks: [{ playerName: "Puka Nacua", price: 62, auctionOwner: "Owner11" }] },
        now: new Date(now.getTime() + 1_100),
      },
    });
    const sethSimulationBody = expectBodyRecord(sethSimulation.body);
    const sethSimulationRecord = expectBodyRecord(sethSimulationBody.simulation);
    const sethSimulationId = expectString(sethSimulationRecord.id);
  return sethSimulationId;
};
