import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import {
  platformJobTypes,
  type DraftRoomExportJobResult,
} from "../../src/platform/platformJobOrchestrator.js";
import { runPlatformWorkerOnce } from "../../src/platform/platformWorker.js";
import { enqueueExportJob, now } from "./fixtures.js";

describe("platform worker leases and cancellation", () => {
  it("keeps the lease alive while a long job handler is running", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueExportJob(repository);
    let heartbeatCalls = 0;
    let heartbeatStopped = false;
    const completedJob = await runPlatformWorkerOnce({
      repository,
      workerId: "worker_exports",
      now: new Date(now.getTime() + 1_000),
      heartbeatIntervalMs: 30_000,
      heartbeatScheduler: heartbeat => {
        heartbeatCalls += 1;
        void heartbeat();
        return () => {
          heartbeatStopped = true;
        };
      },
      handlers: {
        [platformJobTypes.draftRoomExport]: async (payload): Promise<DraftRoomExportJobResult> => {
          await Promise.resolve();
          return {
            type: platformJobTypes.draftRoomExport,
            draftRoomId: payload.draftRoomId,
            format: payload.format,
            artifactId: "export_room_final_rev9",
            storageKey: "exports/room_final/rev9.csv",
            rowCount: 24,
          };
        },
      },
    });
    expect(heartbeatCalls).toBe(1);
    expect(heartbeatStopped).toBe(true);
    expect(completedJob).toMatchObject({ id: job.id, status: "completed" });
  });

  it("cancels a running job at the handler boundary instead of completing it", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueExportJob(repository);
    const canceledJob = await runPlatformWorkerOnce({
      repository,
      workerId: "worker_exports",
      now: new Date(now.getTime() + 1_000),
      handlers: {
        [platformJobTypes.draftRoomExport]: async (payload, context): Promise<DraftRoomExportJobResult> => {
          await repository.cancelJob({
            jobId: context.job.id,
            userId: context.job.userId,
            now: new Date(now.getTime() + 2_000),
          });
          return {
            type: platformJobTypes.draftRoomExport,
            draftRoomId: payload.draftRoomId,
            format: payload.format,
            artifactId: "export_room_final_rev9",
            storageKey: "exports/room_final/rev9.csv",
            rowCount: 24,
          };
        },
      },
    });
    expect(canceledJob).toMatchObject({
      id: job.id,
      status: "canceled",
      resultSummary: undefined,
      workerId: undefined,
    });
  });

  it("does not retry a canceled job when the handler throws", async () => {
    const repository = new InMemoryJobQueue();
    const job = enqueueExportJob(repository, 2);
    const canceledJob = await runPlatformWorkerOnce({
      repository,
      workerId: "worker_exports",
      now: new Date(now.getTime() + 1_000),
      handlers: {
        [platformJobTypes.draftRoomExport]: async (_payload, context): Promise<DraftRoomExportJobResult> => {
          await repository.cancelJob({
            jobId: context.job.id,
            userId: context.job.userId,
            now: new Date(now.getTime() + 2_000),
          });
          throw new Error("export failed after cancellation");
        },
      },
    });
    expect(canceledJob).toMatchObject({
      id: job.id,
      status: "canceled",
      attempts: 0,
      workerId: undefined,
    });
    expect(repository.claimNextJob({
      workerId: "worker_retry",
      now: new Date(now.getTime() + 3_000),
    })).toBeNull();
  });
});
