import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../src/platform/jobs.js";
import {
  enqueueDraftRoomExportJob,
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
  type DraftRoomExportJobResult,
  type SimulationRunExecutionJobResult,
} from "../src/platform/platformJobOrchestrator.js";
import {
  runPlatformWorkerLoop,
  runPlatformWorkerOnce,
} from "../src/platform/platformWorker.js";

const now = new Date("2026-08-09T12:00:00.000Z");

describe("platform worker", () => {
  it("dispatches one queued platform job through the shared repository", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueDraftRoomExportJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 9,
      now,
    });

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

    expect(stats).toEqual({
      iterations: 3,
      dispatchedJobs: 0,
      idlePolls: 3,
      errors: 0,
    });
    expect(sleepCalls).toEqual([250, 250, 250]);
  });

  it("claims only configured job kinds", async () => {
    const repository = new InMemoryJobQueue();
    const exportJob = enqueueDraftRoomExportJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 9,
      now,
    });
    const simulationJob = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
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

  it("surfaces unexpected poll errors through onError and keeps looping", async () => {
    const repository = new InMemoryJobQueue();
    const errors: unknown[] = [];
    let firstClaim = true;
    const originalClaimNextJob = repository.claimNextJob.bind(repository);
    const failingRepository: InMemoryJobQueue = Object.assign(repository, {
      claimNextJob: (input: Parameters<InMemoryJobQueue["claimNextJob"]>[0]) => {
        if (firstClaim) {
          firstClaim = false;
          throw new Error("database unavailable");
        }

        return originalClaimNextJob(input);
      },
    });

    const stats = await runPlatformWorkerLoop({
      repository: failingRepository,
      workerId: "worker_resilient",
      pollIntervalMs: 10,
      maxIterations: 2,
      handlers: {},
      onError: error => {
        errors.push(error);
      },
      sleep: async () => undefined,
    });

    expect(stats).toMatchObject({ iterations: 2, errors: 1 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
  });
});
