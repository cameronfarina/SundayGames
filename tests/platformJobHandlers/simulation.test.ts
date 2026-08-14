import { describe, expect, it } from "vitest";
import { createPlatformJobHandlers } from "../../src/platform/platformJobHandlers.js";
import {
  dispatchNextPlatformJob,
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
} from "../../src/platform/platformJobOrchestrator.js";
import { createSimulationJobFixture, now } from "./support.js";

describe("platform simulation job handler", () => {
  it("dispatches an idempotent simulation job through the app and reports execution progress", async () => {
    const fixture = await createSimulationJobFixture();
    const duplicateJob = enqueueSimulationRunExecutionJob({
      repository: fixture.repository,
      userId: fixture.owner11.account.id,
      leagueId: fixture.season.leagueId,
      seasonId: fixture.season.id,
      simulationRunId: fixture.simulation.id,
      runCount: 12,
      seedPrefix: "owner11-balanced",
      now: new Date(now.getTime() + 500),
    });
    expect(duplicateJob).toBe(fixture.job);

    const dispatchedAt = new Date(now.getTime() + 1_000);
    const completedJob = await dispatchNextPlatformJob({
      repository: fixture.repository,
      workerId: "worker_simulations",
      now: dispatchedAt,
      handlers: createPlatformJobHandlers({ app: fixture.app, persist: fixture.persist }),
    });
    expect(completedJob).toBe(fixture.job);
    expect(fixture.workerExecution).toHaveBeenCalledWith({
      runId: fixture.simulation.id,
      userId: fixture.owner11.account.id,
      leagueId: fixture.season.leagueId,
      seasonId: fixture.season.id,
      now: dispatchedAt,
    });
    expect(fixture.persist).toHaveBeenCalledTimes(1);
    expect(fixture.runnerCalls).toEqual([expect.objectContaining({
      runsPerScenario: 12,
      seedPrefix: "owner11-balanced",
      forcedSales: [{ owner: "Owner11", player: "Puka Nacua", price: 62 }],
    })]);
    expect(fixture.updateProgress).toHaveBeenCalledTimes(2);
    expect(fixture.updateProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
      jobId: fixture.job.id,
      workerId: "worker_simulations",
      progress: { completed: 0, total: 12, message: "Running simulation run 0/12" },
    }));
    expect(fixture.updateProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
      jobId: fixture.job.id,
      workerId: "worker_simulations",
      progress: { completed: 12, total: 12, message: "Completed simulation run 12/12" },
    }));
    expect(fixture.progressEvents).toEqual([
      "Running simulation run 0/12", "runner", "persist", "Completed simulation run 12/12",
    ]);
    expect(completedJob).toMatchObject({
      status: "completed",
      resultSummary: {
        type: platformJobTypes.simulationRunExecution,
        simulationRunId: fixture.simulation.id,
        runCount: 12,
        completedRunCount: 12,
      },
    });
    await expect(dispatchNextPlatformJob({
      repository: fixture.repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 2_000),
      handlers: createPlatformJobHandlers({ app: fixture.app, persist: fixture.persist }),
    })).resolves.toBeNull();
  });
});
