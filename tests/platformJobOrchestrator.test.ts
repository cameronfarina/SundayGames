import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../src/platform/jobs.js";
import {
  dispatchNextPlatformJob,
  enqueueDraftRoomExportJob,
  enqueueHistoricalImportParseJob,
  enqueuePricingRebuildJob,
  enqueueSimulationRunExecutionJob,
  platformJobTypes,
  type DraftRoomExportJobResult,
  type HistoricalImportParseJobResult,
  type PricingRebuildJobResult,
} from "../src/platform/platformJobOrchestrator.js";

const now = new Date("2026-08-09T12:00:00.000Z");

describe("platform job orchestrator", () => {
  it("allows only one outstanding execution job for a simulation run", () => {
    const repository = new InMemoryJobQueue();
    const first = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      simulationRunId: "sim_cam_plan",
      runCount: 25,
      idempotencyKey: "attacker-controlled-first",
      now,
    });
    const second = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      simulationRunId: "sim_cam_plan",
      runCount: 25,
      idempotencyKey: "attacker-controlled-second",
      now: new Date(now.getTime() + 1_000),
    });

    expect(second).toBe(first);
    expect(repository.listForUser("user_cam")).toEqual([first]);
    expect(first.idempotencyKey).toBe("simulation-run-execution:sim_cam_plan");
  });

  it("enqueues product jobs idempotently with type-specific keys mapped to repository job kinds", () => {
    const repository = new InMemoryJobQueue();

    const simulationJob = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      simulationRunId: "sim_cam_plan",
      modelRunId: "pricing-model-run-2026",
      keeperScenarioId: "keepers-expected",
      runCount: 25,
      seedPrefix: "cam-balanced",
      strategyKey: "balanced",
      now,
    });
    const duplicateSimulationJob = enqueueSimulationRunExecutionJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      simulationRunId: "sim_cam_plan",
      modelRunId: "pricing-model-run-2026",
      keeperScenarioId: "keepers-expected",
      runCount: 25,
      seedPrefix: "cam-balanced",
      strategyKey: "balanced",
      now: new Date(now.getTime() + 1_000),
    });
    const importJob = enqueueHistoricalImportParseJob({
      repository,
      userId: "user_commish",
      leagueId: "league_214674",
      seasonId: "season_2025",
      seasonYear: 2025,
      fileHash: "sha256:board-v1",
      sourceFilename: "2025-board.csv",
      contentType: "text/csv",
      now,
    });
    const pricingJob = enqueuePricingRebuildJob({
      repository,
      userId: "user_commish",
      leagueId: "league_214674",
      seasonId: "season_2026",
      seasonYear: 2026,
      modelVersion: "auction-v1",
      inputSnapshotId: "input-snapshot-2026",
      inputHash: "hash-2026",
      scenarioIds: ["expected", "high-retention"],
      reason: "historical-import-committed",
      now,
    });
    const exportJob = enqueueDraftRoomExportJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 42,
      now,
    });

    expect(duplicateSimulationJob).toBe(simulationJob);
    expect(simulationJob).toMatchObject({
      kind: "simulation",
      idempotencyKey: "simulation-run-execution:sim_cam_plan",
      inputJson: {
        type: platformJobTypes.simulationRunExecution,
        simulationRunId: "sim_cam_plan",
        modelRunId: "pricing-model-run-2026",
        keeperScenarioId: "keepers-expected",
        runCount: 25,
        seedPrefix: "cam-balanced",
        strategyKey: "balanced",
      },
    });
    expect(importJob).toMatchObject({
      kind: "import",
      idempotencyKey: "historical-import-parse:2025:sha256:board-v1",
      inputJson: {
        type: platformJobTypes.historicalImportParse,
        seasonYear: 2025,
        fileHash: "sha256:board-v1",
        sourceFilename: "2025-board.csv",
        contentType: "text/csv",
      },
    });
    expect(pricingJob).toMatchObject({
      kind: "model_run",
      idempotencyKey: "pricing-rebuild:auction-v1:input-snapshot-2026:expected,high-retention",
    });
    expect(exportJob).toMatchObject({
      kind: "export",
      idempotencyKey: "draft-room-export:room_final:42:csv",
    });
  });

  it("dispatches a reclaimed stale lock through the matching handler", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueDraftRoomExportJob({
      repository,
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "xlsx",
      sourceRevision: 7,
      now,
    });
    const firstClaimedAt = new Date(now.getTime() + 1_000);
    repository.claimNextJob({
      workerId: "worker_crashed",
      now: firstClaimedAt,
      lockTtlMs: 1_000,
    });

    const reclaimedAt = new Date(now.getTime() + 3_000);
    const completedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_reclaimer",
      now: reclaimedAt,
      lockTtlMs: 10_000,
      handlers: {
        [platformJobTypes.draftRoomExport]: (payload): DraftRoomExportJobResult => ({
          type: platformJobTypes.draftRoomExport,
          draftRoomId: payload.draftRoomId,
          format: payload.format,
          artifactId: "export_room_final_rev7",
          storageKey: "exports/room_final/rev7.xlsx",
          rowCount: 24,
        }),
      },
    });

    expect(completedJob).toBe(job);
    expect(completedJob).toMatchObject({
      status: "completed",
      startedAt: firstClaimedAt,
      finishedAt: reclaimedAt,
      resultSummary: {
        type: platformJobTypes.draftRoomExport,
        draftRoomId: "room_final",
        format: "xlsx",
        artifactId: "export_room_final_rev7",
        storageKey: "exports/room_final/rev7.xlsx",
        rowCount: 24,
      },
    });
  });

  it("dispatches a queued job successfully and marks it completed", async () => {
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
      now,
    });
    const handlerCalls: unknown[] = [];
    const dispatchedAt = new Date(now.getTime() + 2_000);

    const completedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_prices",
      now: dispatchedAt,
      handlers: {
        [platformJobTypes.pricingRebuild]: (payload, context): PricingRebuildJobResult => {
          handlerCalls.push({ payload, jobId: context.job.id, workerId: context.workerId });

          return {
            type: platformJobTypes.pricingRebuild,
            modelRunId: "pricing-model-run-league-214674-2026",
            pricingSnapshotIds: ["pricing-snapshot-expected"],
            scenarioCount: 1,
            warningCount: 0,
          };
        },
      },
    });

    expect(handlerCalls).toEqual([
      {
        payload: {
          type: platformJobTypes.pricingRebuild,
          seasonYear: 2026,
          modelVersion: "auction-v1",
          inputSnapshotId: "input-snapshot-2026",
          inputHash: "hash-2026",
          scenarioIds: ["expected"],
          reason: "manual",
        },
        jobId: job.id,
        workerId: "worker_prices",
      },
    ]);
    expect(completedJob).toMatchObject({
      id: job.id,
      status: "completed",
      finishedAt: dispatchedAt,
      resultSummary: {
        type: platformJobTypes.pricingRebuild,
        modelRunId: "pricing-model-run-league-214674-2026",
        pricingSnapshotIds: ["pricing-snapshot-expected"],
        scenarioCount: 1,
        warningCount: 0,
      },
      workerId: undefined,
      lockExpiresAt: undefined,
    });
  });

  it("marks unknown product job types as failed through the repository lifecycle", async () => {
    const repository = new InMemoryJobQueue();
    const job = repository.submit({
      userId: "user_cam",
      leagueId: "league_214674",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { type: "mystery-job", simulationRunId: "sim_unknown" },
      idempotencyKey: "mystery-job",
      maxAttempts: 1,
      now,
    });

    const failedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_unknown",
      now: new Date(now.getTime() + 1_000),
      handlers: {},
    });

    expect(failedJob).toBe(job);
    if (failedJob === null) throw new Error("Expected unknown product job dispatch to claim a job.");
    expect(failedJob).toMatchObject({
      status: "failed",
      attempts: 1,
      sanitizedError: {
        name: "PlatformJobOrchestratorError",
        message: "Job failed. Check worker logs for details.",
      },
    });
  });

  it("stores sanitized failure messages when a handler throws sensitive details", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueHistoricalImportParseJob({
      repository,
      userId: "user_commish",
      leagueId: "league_214674",
      seasonId: "season_2025",
      seasonYear: 2025,
      fileHash: "sha256:secret-board",
      sourceFilename: "2025-board.csv",
      maxAttempts: 1,
      now,
    });

    const failedJob = await dispatchNextPlatformJob({
      repository,
      workerId: "worker_imports",
      now: new Date(now.getTime() + 1_000),
      handlers: {
        [platformJobTypes.historicalImportParse]: (): HistoricalImportParseJobResult => {
          throw new Error("S3 secret token sk_live_sensitive leaked in parser stack");
        },
      },
    });

    expect(failedJob).toBe(job);
    if (failedJob === null) throw new Error("Expected handler failure dispatch to claim a job.");
    expect(failedJob).toMatchObject({
      status: "failed",
      attempts: 1,
      sanitizedError: {
        name: "Error",
        message: "Job failed. Check worker logs for details.",
      },
    });
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("sk_live_sensitive");
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("parser stack");
  });
});
