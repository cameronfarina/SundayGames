import { describe, expect, it } from "vitest";
import {
  createJobQueueFromSnapshot,
  restoreJobQueueSnapshot,
  snapshotJobQueue,
} from "../src/platform/jobQueueSnapshot.js";
import { InMemoryJobQueue, JobError, type JobRecord } from "../src/platform/jobs.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const jobAt = (jobs: readonly JobRecord[], index: number): JobRecord => {
  const job = jobs[index];
  if (job === undefined) {
    throw new Error(`Missing job at index ${index}.`);
  }

  return job;
};

describe("platform job queue snapshots", () => {
  it("roundtrips queued, running, completed, and failed jobs", () => {
    const queue = new InMemoryJobQueue();
    const runningJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "model_run",
      inputJson: { strategy: "balanced" },
      idempotencyKey: "running-model-run",
      now,
    });
    const completedJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "completed-simulation",
      now: new Date(now.getTime() + 1_000),
    });
    const failedJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "failed-export",
      maxAttempts: 1,
      now: new Date(now.getTime() + 2_000),
    });
    const queuedJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "import",
      inputJson: { source: "espn" },
      idempotencyKey: "queued-import",
      now: new Date(now.getTime() + 3_000),
    });

    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 4_000),
      lockTtlMs: 30_000,
    });
    queue.claimNextJob({
      workerId: "worker_b",
      now: new Date(now.getTime() + 5_000),
      lockTtlMs: 30_000,
    });
    queue.completeJob({
      jobId: completedJob.id,
      workerId: "worker_b",
      resultSummary: { scenarios: 1000, bestStrategy: "balanced" },
      now: new Date(now.getTime() + 6_000),
    });
    queue.claimNextJob({
      workerId: "worker_c",
      now: new Date(now.getTime() + 7_000),
      lockTtlMs: 30_000,
    });
    queue.failJob({
      jobId: failedJob.id,
      workerId: "worker_c",
      error: new TypeError("provider secret"),
      now: new Date(now.getTime() + 8_000),
    });

    const snapshot = snapshotJobQueue(queue);
    const restoredQueue = createJobQueueFromSnapshot(snapshot);

    expect(restoredQueue.jobs()).toEqual(snapshot.jobs);
    expect(restoredQueue.jobs().map(job => [job.id, job.status])).toEqual([
      [runningJob.id, "running"],
      [completedJob.id, "completed"],
      [failedJob.id, "failed"],
      [queuedJob.id, "queued"],
    ]);
  });

  it("snapshots and restores with structured clones instead of shared mutable records", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "clone-boundary",
      now,
    });
    const snapshot = snapshotJobQueue(queue);
    const snapshotJob = jobAt(snapshot.jobs, 0);

    snapshotJob.status = "completed";
    snapshotJob.progress.message = "Mutated snapshot";
    snapshotJob.createdAt = new Date(now.getTime() + 60_000);

    expect(queue.fetchForUser(job.id, "user_cam")).toMatchObject({
      status: "queued",
      progress: { completed: 0, total: 1, message: "Queued" },
      createdAt: now,
    });

    const restoredQueue = new InMemoryJobQueue();
    restoreJobQueueSnapshot(restoredQueue, snapshot);
    snapshotJob.status = "failed";
    snapshotJob.progress.message = "Mutated after restore";

    expect(restoredQueue.fetchForUser(job.id, "user_cam")).toMatchObject({
      status: "completed",
      progress: { completed: 0, total: 1, message: "Mutated snapshot" },
    });
  });

  it("rebuilds the idempotency index after restore", () => {
    const queue = new InMemoryJobQueue();
    const originalJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "restored-idempotency",
      now,
    });
    const restoredQueue = createJobQueueFromSnapshot(snapshotJobQueue(queue));

    const replayedJob = restoredQueue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { scoring: "ppr", iterations: 1000 },
      idempotencyKey: "restored-idempotency",
      now: new Date(now.getTime() + 1_000),
    });

    expect(replayedJob.id).toBe(originalJob.id);
    expect(replayedJob.status).toBe("queued");
    expect(restoredQueue.listForUser("user_cam")).toHaveLength(1);
    expect(() =>
      restoredQueue.submit({
        userId: "user_cam",
        leagueId: "league_home",
        seasonId: "season_2026",
        kind: "simulation",
        inputJson: { iterations: 2000, scoring: "ppr" },
        idempotencyKey: "restored-idempotency",
        now: new Date(now.getTime() + 2_000),
      }),
    ).toThrow(new JobError(
      "idempotency_conflict",
      "A job already exists for this idempotency key with different input.",
    ));

    const otherUserJob = restoredQueue.submit({
      userId: "user_rival",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "restored-idempotency",
      now: new Date(now.getTime() + 3_000),
    });

    expect(otherUserJob.id).not.toBe(originalJob.id);
  });

  it("keeps restored list and fetch access scoped to the requesting user", () => {
    const queue = new InMemoryJobQueue();
    const userJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "user-job",
      now,
    });
    const rivalJob = queue.submit({
      userId: "user_rival",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "rival-job",
      now: new Date(now.getTime() + 1_000),
    });
    const restoredQueue = createJobQueueFromSnapshot(snapshotJobQueue(queue));

    expect(restoredQueue.listForUser("user_cam").map(job => job.id)).toEqual([userJob.id]);
    expect(restoredQueue.fetchForUser(userJob.id, "user_cam")?.id).toBe(userJob.id);
    expect(restoredQueue.fetchForUser(rivalJob.id, "user_cam")).toBeNull();
  });
});
