import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import {
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
  type DraftRoomExportJobResult,
  type SimulationRunExecutionJobResult,
} from "../../src/platform/platformJobOrchestrator.js";
import { runPlatformWorkerLoop, runPlatformWorkerOnce } from "../../src/platform/platformWorker.js";
import { enqueueExportJob, now } from "./fixtures.js";

describe("platform worker dispatch", () => {
  it("dispatches one queued platform job through the shared repository", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueExportJob(repository);
    const completedJob = await runPlatformWorkerOnce({
      repository,
      workerId: "worker_exports",
      now: new Date(now.getTime() + 1_000),
      handlers: {
        [platformJobTypes.draftRoomExport]: (payload): DraftRoomExportJobResult => ({
          type: platformJobTypes.draftRoomExport,
          draftRoomId: payload.draftRoomId,
          format: payload.format,
          artifactId: "export_room_final_rev9",
          storageKey: "exports/room_final/rev9.csv",
          rowCount: 24,
        }),
      },
    });
    expect(completedJob).toMatchObject({
      id: job.id,
      status: "completed",
      resultSummary: {
        type: platformJobTypes.draftRoomExport,
        storageKey: "exports/room_final/rev9.csv",
      },
    });
  });

  it("polls, sleeps on idle iterations, and reports loop stats", async () => {
    const sleepCalls: number[] = [];
    const stats = await runPlatformWorkerLoop({
      repository: new InMemoryJobQueue(),
      workerId: "worker_idle",
      pollIntervalMs: 250,
      maxIterations: 3,
      handlers: {},
      sleep: async milliseconds => {
        sleepCalls.push(milliseconds);
      },
    });
    expect(stats).toEqual({ iterations: 3, dispatchedJobs: 0, idlePolls: 3, errors: 0 });
    expect(sleepCalls).toEqual([250, 250, 250]);
  });

  it("claims only configured job kinds", async () => {
    const repository = new InMemoryJobQueue();
    const exportJob = enqueueExportJob(repository);
    const simulationJob = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      simulationRunId: "sim_123",
      runCount: 25,
      now: new Date(now.getTime() + 1_000),
    });
    const completedJob = await runPlatformWorkerOnce({
      repository,
      workerId: "worker_simulations",
      jobKinds: ["simulation"],
      now: new Date(now.getTime() + 2_000),
      handlers: {
        [platformJobTypes.simulationRunExecution]: (payload): SimulationRunExecutionJobResult => ({
          type: platformJobTypes.simulationRunExecution,
          simulationRunId: payload.simulationRunId,
          runCount: payload.runCount,
          completedRunCount: payload.runCount,
        }),
      },
    });
    expect(completedJob?.id).toBe(simulationJob.id);
    expect(repository.fetchForUser(exportJob.id, "user_cam")).toMatchObject({
      id: exportJob.id,
      status: "queued",
    });
  });
});
