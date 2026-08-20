import { describe, expect, it, vi } from "vitest";
import { createPlatformJobHandlers } from "../../src/platform/platformJobHandlers.js";
import {
  dispatchNextPlatformJob,
  enqueueSeasonSimulationExecutionJob,
  platformJobTypes,
} from "../../src/platform/platformJobOrchestrator.js";
import { encodeSeasonSimulationExecutionJobInput } from "../../src/platform/seasonSimulationJobPayload.js";
import type { RunSeasonSimulationsInput } from "../../src/platform/seasonSimulationEngine.js";
import type { SeasonSimulationRunner } from "../../src/platform/seasonSimulationRunner.js";
import { createSimulationJobFixture, now } from "./support.js";

describe("platform season simulation job handler", () => {
  it("runs a durable season simulation payload and persists incremental progress", async () => {
    const runner: SeasonSimulationRunner = async (input, options) => {
      options?.onProgress?.({ completed: 1, total: input.runCount });
      options?.onProgress?.({ completed: input.runCount, total: input.runCount });
      return {
        draftFormat: "auction",
        runCount: input.runCount,
        completedCount: input.runCount,
        seedPrefix: input.seedPrefix ?? "queued-season",
        strategy: {
          rawInput: input.strategyInput ?? "",
          preferredPositions: [],
          summary: "Balanced",
          warnings: [],
        },
        playerExposure: [],
        positionCounts: {},
        runs: [],
      };
    };
    const seasonRunner = vi.fn(runner);
    const fixture = await createSimulationJobFixture({ seasonSimulationRunner: seasonRunner });
    fixture.repository.replaceJobs([]);
    const setupUpdatedAt = new Date("2026-08-09T11:00:00.000Z");
    const seasonInput: RunSeasonSimulationsInput = {
      season: fixture.season,
      setup: {
        seasonId: fixture.season.id,
        sourceVersion: "queued-season-test",
        playerCatalog: [],
        initialRosters: [],
        contentHash: "queued-season-test-hash",
        updatedAt: setupUpdatedAt,
      },
      humanTeamId: fixture.camTeam.id,
      runCount: 12,
      strategyInput: "Target Puka Nacua",
      seedPrefix: "queued-season",
      historicalSaleRecords: [{
        id: "sale-1",
        batchId: "batch-1",
        leagueId: fixture.season.leagueId,
        leagueSeasonId: fixture.season.id,
        seasonYear: fixture.season.seasonYear - 1,
        rowNumber: 1,
        ownerId: fixture.camTeam.ownerId,
        ownerDisplayName: fixture.camTeam.ownerDisplayName,
        playerId: "player-1",
        playerName: "Puka Nacua",
        position: "WR",
        priceDollars: 62,
        keeper: false,
        acquisitionType: "auction",
      }],
    };
    const job = enqueueSeasonSimulationExecutionJob({
      repository: fixture.repository,
      userId: fixture.owner11.account.id,
      leagueId: fixture.season.leagueId,
      seasonId: fixture.season.id,
      simulationRunId: fixture.simulation.id,
      runCount: 12,
      seasonSimulation: encodeSeasonSimulationExecutionJobInput({
        simulationInput: seasonInput,
        strategyText: seasonInput.strategyInput ?? "",
        note: "Durable worker test",
      }),
      now,
    });

    const completedJob = await dispatchNextPlatformJob({
      repository: fixture.repository,
      workerId: "worker_season_simulations",
      now: new Date(now.getTime() + 1_000),
      handlers: createPlatformJobHandlers({ app: fixture.app, persist: fixture.persist }),
    });

    expect(completedJob).toBe(job);
    expect(job).toMatchObject({
      kind: "season_simulation",
      inputJson: { type: "season-simulation-execution-v1" },
    });
    expect(fixture.workerExecution).not.toHaveBeenCalled();
    expect(seasonRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        historicalSaleRecords: seasonInput.historicalSaleRecords,
        setup: expect.objectContaining({ updatedAt: setupUpdatedAt }),
      }),
      expect.objectContaining({ accountId: fixture.owner11.account.id }),
    );
    expect(fixture.updateProgress).toHaveBeenCalledTimes(4);
    expect(completedJob).toMatchObject({
      status: "completed",
      progress: { completed: 1, total: 1, message: "Completed" },
      resultSummary: {
        type: platformJobTypes.seasonSimulationExecution,
        simulationRunId: fixture.simulation.id,
        runCount: 12,
        completedRunCount: 12,
      },
    });
    await expect(fixture.app.getSimulationRun({
      actorSessionToken: fixture.owner11.sessionToken,
      runId: fixture.simulation.id,
      now,
    })).resolves.toMatchObject({
      status: "completed",
      result: {
        note: "Durable worker test",
        seasonSimulation: { completedCount: 12 },
      },
    });

    await fixture.app.executeSeasonSimulationRunForWorker({
      runId: fixture.simulation.id,
      userId: fixture.owner11.account.id,
      leagueId: fixture.season.leagueId,
      seasonId: fixture.season.id,
      now: new Date(now.getTime() + 2_000),
      simulationInput: seasonInput,
      strategyText: seasonInput.strategyInput ?? "",
    });
    expect(seasonRunner).toHaveBeenCalledTimes(1);
  });
});
