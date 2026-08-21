import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import { createPlatformJobHandlers } from "../../src/platform/platformJobHandlers.js";
import {
  dispatchNextPlatformJob,
  enqueuePricingRebuildJob,
  platformJobTypes,
  type PlatformJobHandlerContext,
} from "../../src/platform/platformJobOrchestrator.js";
import { now } from "./support.js";

describe("unsupported platform job handlers", () => {
  it("fails unsupported platform jobs instead of completing placeholders", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueuePricingRebuildJob({
      repository,
      userId: "user_commish",
      leagueId: "league_100001",
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
    expect(() => handlers[platformJobTypes.historicalImportParse]({
      type: platformJobTypes.historicalImportParse,
      seasonYear: 2026,
      fileHash: "sha256:board",
      sourceFilename: "board.csv",
    }, context)).toThrow("Platform job handler for historical-import-parse is not implemented yet.");
    expect(() => handlers[platformJobTypes.pricingRebuild]({
      type: platformJobTypes.pricingRebuild,
      seasonYear: 2026,
      modelVersion: "auction-v1",
      inputSnapshotId: "input-snapshot-2026",
      inputHash: "hash-2026",
      scenarioIds: ["expected"],
      reason: "manual",
    }, context)).toThrow("Platform job handler for pricing-rebuild is not implemented yet.");
    expect(() => handlers[platformJobTypes.draftRoomExport]({
      type: platformJobTypes.draftRoomExport,
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 1,
    }, context)).toThrow("Platform job handler for draft-room-export is not implemented yet.");

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
