import { describe, expect, it, vi } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import type { MockBatch } from "../src/modeling/mockBatch.js";
import { InMemoryJobQueue } from "../src/platform/jobs.js";
import { buildCurrentMockdLeagueSeason } from "../src/platform/leagueSeason.js";
import { createPlatformJobHandlers } from "../src/platform/platformJobHandlers.js";
import {
  dispatchNextPlatformJob,
  enqueuePricingRebuildJob,
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
  type PlatformJobHandlerContext,
} from "../src/platform/platformJobOrchestrator.js";
import { createPlatformApp, InMemoryPlatformStore } from "../src/platform/platformApp.js";
import type { SimulationMockBatchRunner } from "../src/platform/simulations.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const mockBatch = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}: Parameters<SimulationMockBatchRunner>[0]): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

const signUpAndLogin = async (
  app: ReturnType<typeof createPlatformApp>,
  email: string,
  password: string,
  createdAt: Date,
) => {
  await app.createAccount({ email, password, now: createdAt });
  const login = await app.login({ email, password, now: createdAt });
  if (login === null) throw new Error(`Expected ${email} login.`);

  return login;
};

describe("platform job handlers", () => {
  it("dispatches an idempotent simulation job through the app and reports execution progress", async () => {
    const repository = new InMemoryJobQueue();
    const progressEvents: string[] = [];
    const originalUpdateProgress = repository.updateProgress.bind(repository);
    const updateProgress = vi.spyOn(repository, "updateProgress").mockImplementation(input => {
      progressEvents.push(input.progress.message);

      return originalUpdateProgress(input);
    });
    const runnerCalls: Array<Parameters<SimulationMockBatchRunner>[0]> = [];
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: options => {
        runnerCalls.push(options);
        progressEvents.push("runner");

        return mockBatch(options);
      },
    });
    const persist = vi.fn(() => {
      progressEvents.push("persist");
    });
    const cam = await signUpAndLogin(app, "cam@example.com", "cam password", now);
    const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
      leagueName: "League 214674",
      setupStatus: "published",
    });
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam team fixture.");

    await app.registerLeagueSeason({
      actorSessionToken: cam.sessionToken,
      season,
      memberships: [
        {
          userId: cam.account.id,
          leagueId: season.leagueId,
          role: "owner",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
      now,
    });
    const simulation = await app.createSimulationRun({
      actorSessionToken: cam.sessionToken,
      leagueId: season.leagueId,
      seasonId: season.id,
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      count: 12,
      seedPrefix: "cam-balanced",
      idempotencyKey: "cam-balanced",
      strategy: {
        hardLocks: [
          { playerName: "Puka Nacua", price: 62, auctionOwner: "Cam" },
        ],
      },
      now,
    });
    const workerExecution = vi.spyOn(app, "executeSimulationRunForWorker");
    const job = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 12,
      seedPrefix: "cam-balanced",
      now,
    });
    const duplicateJob = enqueueSimulationRunExecutionJob({
      repository,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      simulationRunId: simulation.id,
      runCount: 12,
      seedPrefix: "cam-balanced",
      now: new Date(now.getTime() + 500),
    });

    expect(duplicateJob).toBe(job);

    const dispatchedAt = new Date(now.getTime() + 1_000);
    const completedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: dispatchedAt,
      handlers: createPlatformJobHandlers({ app, persist }),
    });

    expect(completedJob).toBe(job);
    expect(workerExecution).toHaveBeenCalledWith({
      runId: simulation.id,
      userId: cam.account.id,
      leagueId: season.leagueId,
      seasonId: season.id,
      now: dispatchedAt,
    });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(runnerCalls).toEqual([
      expect.objectContaining({
        runsPerScenario: 12,
        seedPrefix: "cam-balanced",
        forcedSales: [{ owner: "Cam", player: "Puka Nacua", price: 62 }],
      }),
    ]);
    expect(updateProgress).toHaveBeenCalledTimes(2);
    expect(updateProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({
      jobId: job.id,
      workerId: "worker_simulations",
      progress: {
        completed: 0,
        total: 12,
        message: "Running simulation run 0/12",
      },
    }));
    expect(updateProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({
      jobId: job.id,
      workerId: "worker_simulations",
      progress: {
        completed: 12,
        total: 12,
        message: "Completed simulation run 12/12",
      },
    }));
    expect(progressEvents).toEqual([
      "Running simulation run 0/12",
      "runner",
      "persist",
      "Completed simulation run 12/12",
    ]);
    expect(completedJob).toMatchObject({
      status: "completed",
      resultSummary: {
        type: platformJobTypes.simulationRunExecution,
        simulationRunId: simulation.id,
        runCount: 12,
        completedRunCount: 12,
      },
    });

    await expect(dispatchNextPlatformJob({
      repository,
      workerId: "worker_simulations",
      now: new Date(now.getTime() + 2_000),
      handlers: createPlatformJobHandlers({ app, persist }),
    })).resolves.toBeNull();
  });

  it("fails unsupported platform jobs instead of completing placeholders", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueuePricingRebuildJob({
      repository,
      userId: "user_commish",
      leagueId: "league_214674",
      seasonId: "season_2026",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      inputSnapshotId: "input-snapshot-2026",
      inputHash: "hash-2026",
      scenarioIds: ["expected"],
      reason: "manual",
      maxAttempts: 1,
      now,
    });

    const handlers = createPlatformJobHandlers({
      app: {
        executeSimulationRunForWorker: async () => {
          throw new Error("Unexpected simulation execution.");
        },
      },
    });
    const context: PlatformJobHandlerContext = {
      job,
      workerId: "worker_prices",
      updateProgress: () => job,
      heartbeat: () => job,
    };

    expect(() =>
      handlers[platformJobTypes.historicalImportParse]({
        type: platformJobTypes.historicalImportParse,
        seasonYear: 2026,
        fileHash: "sha256:board",
        sourceFilename: "board.csv",
      }, context),
    ).toThrow("Platform job handler for historical-import-parse is not implemented yet.");
    expect(() =>
      handlers[platformJobTypes.pricingRebuild]({
        type: platformJobTypes.pricingRebuild,
        seasonYear: 2026,
        modelVersion: "auction-v1",
        inputSnapshotId: "input-snapshot-2026",
        inputHash: "hash-2026",
        scenarioIds: ["expected"],
        reason: "manual",
      }, context),
    ).toThrow("Platform job handler for pricing-rebuild is not implemented yet.");
    expect(() =>
      handlers[platformJobTypes.draftRoomExport]({
        type: platformJobTypes.draftRoomExport,
        draftRoomId: "room_final",
        format: "csv",
        sourceRevision: 1,
      }, context),
    ).toThrow("Platform job handler for draft-room-export is not implemented yet.");

    const failedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_prices",
      now: new Date(now.getTime() + 1_000),
      handlers,
    });

    expect(failedJob).toBe(job);
    expect(failedJob).toMatchObject({
      status: "failed",
      resultSummary: undefined,
      sanitizedError: {
        name: "UnsupportedPlatformJobHandlerError",
        message: "Job failed. Check worker logs for details.",
      },
    });
  });
});
