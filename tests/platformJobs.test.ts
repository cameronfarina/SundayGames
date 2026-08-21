import { describe, expect, it } from "vitest";
import { InMemoryJobQueue, JobError, canAccessJob } from "../src/platform/jobs.js";

const now = new Date("2026-08-09T12:00:00.000Z");

describe("platform async jobs", () => {
  it("submits queued jobs idempotently for the same user, league, season, and idempotency key", () => {
    const queue = new InMemoryJobQueue();

    const firstJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "simulate-current-settings",
      now,
    });
    const secondJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "simulate-current-settings",
      now: new Date(now.getTime() + 1_000),
    });

    expect(firstJob).toEqual({
      id: expect.stringMatching(/^job_/),
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      status: "queued",
      inputJson: { iterations: 1000, scoring: "ppr" },
      inputHash: expect.any(String),
      idempotencyKey: "simulate-current-settings",
      progress: { completed: 0, total: 1, message: "Queued" },
      attempts: 0,
      maxAttempts: 3,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      cancellationRequestedAt: undefined,
      resultSummary: undefined,
      sanitizedError: undefined,
      createdAt: now,
      updatedAt: now,
    });
    expect(secondJob).toBe(firstJob);
    expect(queue.listForUser("user_cam")).toEqual([firstJob]);
  });

  it("scopes job idempotency keys by season", () => {
    const queue = new InMemoryJobQueue();

    const season2026Job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "simulate-current-settings",
      now,
    });
    const season2027Job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2027",
      kind: "simulation",
      inputJson: { iterations: 1000, scoring: "ppr" },
      idempotencyKey: "simulate-current-settings",
      now: new Date(now.getTime() + 1_000),
    });

    expect(season2027Job).not.toBe(season2026Job);
    expect(queue.listForUser("user_cam").map(job => job.seasonId)).toEqual([
      "season_2026",
      "season_2027",
    ]);
  });

  it("rejects reused idempotency keys with different input", () => {
    const queue = new InMemoryJobQueue();

    queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv", includeKeepers: true },
      idempotencyKey: "export-board",
      now,
    });

    expect(() =>
      queue.submit({
        userId: "user_cam",
        leagueId: "league_home",
        seasonId: "season_2026",
        kind: "export",
        inputJson: { format: "xlsx", includeKeepers: true },
        idempotencyKey: "export-board",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new JobError(
      "idempotency_conflict",
      "A job already exists for this idempotency key with different input.",
    ));
  });

  it("reruns terminal jobs idempotently with fresh queued lifecycle state", () => {
    const queue = new InMemoryJobQueue();
    const originalJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "simulate-original",
      now,
    });
    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    queue.cancelJob({
      jobId: originalJob.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });
    queue.cancelJobAtRunBoundary({
      jobId: originalJob.id,
      workerId: "worker_a",
      now: new Date(now.getTime() + 3_000),
    });

    const rerunAt = new Date(now.getTime() + 4_000);
    const rerunJob = queue.rerunJob({
      jobId: originalJob.id,
      userId: "user_cam",
      idempotencyKey: "rerun-click-1",
      now: rerunAt,
    });
    const rerunAgain = queue.rerunJob({
      jobId: originalJob.id,
      userId: "user_cam",
      idempotencyKey: "rerun-click-1",
      now: new Date(now.getTime() + 5_000),
    });

    expect(rerunJob).not.toBe(originalJob);
    expect(rerunAgain).toBe(rerunJob);
    expect(rerunJob).toMatchObject({
      userId: originalJob.userId,
      leagueId: originalJob.leagueId,
      seasonId: originalJob.seasonId,
      kind: originalJob.kind,
      status: "queued",
      inputJson: originalJob.inputJson,
      inputHash: originalJob.inputHash,
      idempotencyKey: `rerun:${originalJob.id}:rerun-click-1`,
      progress: { completed: 0, total: 1, message: "Queued" },
      attempts: 0,
      maxAttempts: originalJob.maxAttempts,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      cancellationRequestedAt: undefined,
      resultSummary: undefined,
      sanitizedError: undefined,
      createdAt: rerunAt,
      updatedAt: rerunAt,
    });
    expect(queue.listForUser("user_cam").map(job => job.id)).toEqual([originalJob.id, rerunJob.id]);
  });

  it("rejects reruns for active jobs and jobs owned by another user", () => {
    const queue = new InMemoryJobQueue();
    const activeJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "active-job",
      now,
    });

    expect(() =>
      queue.rerunJob({
        jobId: activeJob.id,
        userId: "user_cam",
        idempotencyKey: "rerun-active",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new JobError("job_not_terminal", "Only completed, failed, or canceled jobs can be rerun."));
    expect(() =>
      queue.rerunJob({
        jobId: activeJob.id,
        userId: "user_seth",
        idempotencyKey: "rerun-rival",
        now: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new JobError("job_owner_required", "Job belongs to another user."));
  });

  it("claims the oldest queued job with a worker lock and heartbeat", () => {
    const queue = new InMemoryJobQueue();
    const olderJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "import",
      inputJson: { source: "espn" },
      idempotencyKey: "import-espn",
      now,
    });
    queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "simulate",
      now: new Date(now.getTime() + 1_000),
    });

    const claimedAt = new Date(now.getTime() + 2_000);
    const claimedJob = queue.claimNextJob({
      workerId: "worker_a",
      now: claimedAt,
      lockTtlMs: 30_000,
    });

    expect(claimedJob).toBe(olderJob);
    expect(claimedJob).toMatchObject({
      id: olderJob.id,
      status: "running",
      workerId: "worker_a",
      lockedAt: claimedAt,
      heartbeatAt: claimedAt,
      lockExpiresAt: new Date(claimedAt.getTime() + 30_000),
      startedAt: claimedAt,
      updatedAt: claimedAt,
    });
  });

  it("reclaims expired running job locks after a worker crash", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "reclaim-simulation",
      now,
    });
    const firstClaimAt = new Date(now.getTime() + 1_000);
    const firstClaim = queue.claimNextJob({
      workerId: "worker_a",
      now: firstClaimAt,
      lockTtlMs: 1_000,
    });

    expect(firstClaim).toBe(job);

    const reclaimedAt = new Date(now.getTime() + 3_000);
    const reclaimedJob = queue.claimNextJob({
      workerId: "worker_b",
      now: reclaimedAt,
      lockTtlMs: 5_000,
    });

    expect(reclaimedJob).toBe(job);
    expect(reclaimedJob).toMatchObject({
      status: "running",
      workerId: "worker_b",
      lockedAt: reclaimedAt,
      heartbeatAt: reclaimedAt,
      lockExpiresAt: new Date(reclaimedAt.getTime() + 5_000),
      startedAt: firstClaimAt,
      updatedAt: reclaimedAt,
    });
  });

  it("updates progress only for the worker holding a running job lock", () => {
    const queue = new InMemoryJobQueue();
    const queuedJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "model_run",
      inputJson: { strategy: "stars-and-scrubs" },
      idempotencyKey: "model-run",
      now,
    });

    expect(() =>
      queue.updateProgress({
        jobId: queuedJob.id,
        workerId: "worker_a",
        progress: { completed: 1, total: 4, message: "Parsing inputs" },
        now: new Date(now.getTime() + 500),
      }),
    ).toThrow(new JobError("job_not_running", "Job is not running."));

    const claimedJob = queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    const progressAt = new Date(now.getTime() + 2_000);

    expect(claimedJob).not.toBeNull();
    expect(() =>
      queue.updateProgress({
        jobId: queuedJob.id,
        workerId: "worker_b",
        progress: { completed: 1, total: 4, message: "Parsing inputs" },
        now: progressAt,
      }),
    ).toThrow(new JobError("job_lock_mismatch", "Job is locked by another worker."));

    const updatedJob = queue.updateProgress({
      jobId: queuedJob.id,
      workerId: "worker_a",
      progress: { completed: 1, total: 4, message: "Parsing inputs" },
      now: progressAt,
    });

    expect(updatedJob.progress).toEqual({ completed: 1, total: 4, message: "Parsing inputs" });
    expect(updatedJob.heartbeatAt).toBe(progressAt);
    expect(updatedJob.updatedAt).toBe(progressAt);
  });

  it("heartbeats a running locked job without changing progress", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "model_run",
      inputJson: { strategy: "balanced" },
      idempotencyKey: "heartbeat-model-run",
      now,
    });
    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
      lockTtlMs: 10_000,
    });

    const heartbeatAt = new Date(now.getTime() + 5_000);

    expect(() =>
      queue.heartbeatJob({
        jobId: job.id,
        workerId: "worker_b",
        now: heartbeatAt,
      }),
    ).toThrow(new JobError("job_lock_mismatch", "Job is locked by another worker."));

    const heartbeatedJob = queue.heartbeatJob({
      jobId: job.id,
      workerId: "worker_a",
      now: heartbeatAt,
      lockTtlMs: 20_000,
    });

    expect(heartbeatedJob).toMatchObject({
      progress: { completed: 0, total: 1, message: "Queued" },
      heartbeatAt,
      lockExpiresAt: new Date(heartbeatAt.getTime() + 20_000),
      updatedAt: heartbeatAt,
    });
  });

  it("completes a running locked job with a result summary and finished timestamp", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "complete-simulation",
      now,
    });
    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });

    const finishedAt = new Date(now.getTime() + 5_000);
    const completedJob = queue.completeJob({
      jobId: job.id,
      workerId: "worker_a",
      resultSummary: { scenarios: 1000, bestStrategy: "balanced" },
      now: finishedAt,
    });

    expect(completedJob).toMatchObject({
      id: job.id,
      status: "completed",
      progress: { completed: 1, total: 1, message: "Completed" },
      resultSummary: { scenarios: 1000, bestStrategy: "balanced" },
      finishedAt,
      updatedAt: finishedAt,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
    });
  });

  it("does not let completion overwrite a requested cancellation", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-before-complete",
      now,
    });
    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    queue.cancelJob({
      jobId: job.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });

    expect(() =>
      queue.completeJob({
        jobId: job.id,
        workerId: "worker_a",
        resultSummary: { completed: true },
        now: new Date(now.getTime() + 3_000),
      }),
    ).toThrow(new JobError("job_not_claimable", "Job has requested cancellation."));
    expect(queue.fetchForUser(job.id, "user_cam")).toMatchObject({
      status: "running",
      cancellationRequestedAt: new Date(now.getTime() + 2_000),
      resultSummary: undefined,
    });
  });

  it("retries failures while attempts remain and stores a sanitized error when exhausted", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "import",
      inputJson: { source: "sleeper" },
      idempotencyKey: "retry-import",
      maxAttempts: 2,
      now,
    });

    queue.claimNextJob({ workerId: "worker_a", now: new Date(now.getTime() + 1_000) });
    const retryAt = new Date(now.getTime() + 2_000);
    const retriedJob = queue.failJob({
      jobId: job.id,
      workerId: "worker_a",
      error: new Error("provider token sk_live_secret leaked\nat stack frame"),
      now: retryAt,
    });

    expect(retriedJob).toMatchObject({
      status: "queued",
      attempts: 1,
      sanitizedError: {
        name: "Error",
        message: "Job failed. Check worker logs for details.",
      },
      finishedAt: undefined,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
      updatedAt: retryAt,
    });

    queue.claimNextJob({ workerId: "worker_b", now: new Date(now.getTime() + 3_000) });
    const exhaustedAt = new Date(now.getTime() + 4_000);
    const failedJob = queue.failJob({
      jobId: job.id,
      workerId: "worker_b",
      error: new TypeError("another sensitive detail"),
      now: exhaustedAt,
    });

    expect(failedJob).toMatchObject({
      status: "failed",
      attempts: 2,
      sanitizedError: {
        name: "TypeError",
        message: "Job failed. Check worker logs for details.",
      },
      finishedAt: exhaustedAt,
      updatedAt: exhaustedAt,
    });
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("sk_live_secret");
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("stack frame");
  });

  it("settles canceled running jobs as canceled when the handler fails", () => {
    const queue = new InMemoryJobQueue();
    const job = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-failed-handler",
      maxAttempts: 2,
      now,
    });
    queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    queue.cancelJob({
      jobId: job.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });

    const canceledJob = queue.failJob({
      jobId: job.id,
      workerId: "worker_a",
      error: new Error("handler failed after cancellation"),
      now: new Date(now.getTime() + 3_000),
    });

    expect(canceledJob).toMatchObject({
      status: "canceled",
      attempts: 0,
      finishedAt: new Date(now.getTime() + 3_000),
      sanitizedError: undefined,
      workerId: undefined,
    });
  });

  it("cancels queued jobs before claim and lets running jobs cancel at a run boundary", () => {
    const queue = new InMemoryJobQueue();
    const queuedJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "cancel-export",
      now,
    });
    const nextJob = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "after-cancel",
      now: new Date(now.getTime() + 1_000),
    });

    const canceledAt = new Date(now.getTime() + 2_000);
    const canceledQueuedJob = queue.cancelJob({
      jobId: queuedJob.id,
      userId: "user_cam",
      now: canceledAt,
    });

    expect(canceledQueuedJob).toMatchObject({
      status: "canceled",
      cancellationRequestedAt: canceledAt,
      finishedAt: canceledAt,
      updatedAt: canceledAt,
    });
    expect(queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 3_000),
    })).toBe(nextJob);

    const runningCanceledAt = new Date(now.getTime() + 4_000);
    const cancelRequestedJob = queue.cancelJob({
      jobId: nextJob.id,
      userId: "user_cam",
      now: runningCanceledAt,
    });

    expect(cancelRequestedJob).toMatchObject({
      status: "running",
      cancellationRequestedAt: runningCanceledAt,
      finishedAt: undefined,
    });

    const boundaryAt = new Date(now.getTime() + 5_000);
    const boundaryCanceledJob = queue.cancelJobAtRunBoundary({
      jobId: nextJob.id,
      workerId: "worker_a",
      now: boundaryAt,
    });

    expect(boundaryCanceledJob).toMatchObject({
      status: "canceled",
      finishedAt: boundaryAt,
      updatedAt: boundaryAt,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
    });
  });

  it("lists and fetches only jobs owned by the requesting user", () => {
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

    expect(queue.listForUser("user_cam")).toEqual([userJob]);
    expect(queue.fetchForUser(userJob.id, "user_cam")).toBe(userJob);
    expect(queue.fetchForUser(rivalJob.id, "user_cam")).toBeNull();
    expect(canAccessJob("user_cam", userJob)).toBe(true);
    expect(canAccessJob("user_cam", rivalJob)).toBe(false);
  });
});
