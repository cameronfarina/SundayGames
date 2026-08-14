import { describe, expect, it } from "vitest";
import { InMemoryJobQueue, JobError } from "../src/platform/jobs.js";
import { maximumRetainedTerminalJobsPerUser } from "../src/platform/jobHistory.js";

const now = new Date("2026-08-14T12:00:00.000Z");

const simulationPayload = {
  type: "simulation-run-execution",
  simulationRunId: "sim_owner11_strategy",
  runCount: 25,
};

describe("simulation rerun admission", () => {
  it("admits one concurrent rerun per simulation regardless of client keys", async () => {
    const queue = new InMemoryJobQueue();
    const original = queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: simulationPayload,
      idempotencyKey: "simulation-run-execution:sim_owner11_strategy",
      now,
    });
    queue.cancelJob({
      jobId: original.id,
      userId: original.userId,
      now: new Date(now.getTime() + 1_000),
    });

    const outcomes = await Promise.allSettled(Array.from(
      { length: 100 },
      (_, index) => Promise.resolve().then(() => queue.rerunJob({
        jobId: original.id,
        userId: original.userId,
        idempotencyKey: `attacker-key-${index}`,
        now: new Date(now.getTime() + 2_000),
      })),
    ));
    const accepted = outcomes.filter(outcome => outcome.status === "fulfilled");
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(99);
    for (const outcome of rejected) {
      expect(outcome.reason).toEqual(new JobError(
        "job_already_active",
        "A rerun is already queued or running for this simulation.",
      ));
    }
    expect(queue.jobs()).toHaveLength(2);
  });

  it("reuses the bounded rerun slot after it reaches a terminal state", () => {
    const queue = new InMemoryJobQueue();
    const original = queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: simulationPayload,
      idempotencyKey: "simulation-run-execution:sim_owner11_strategy",
      now,
    });
    queue.cancelJob({ jobId: original.id, userId: original.userId, now });
    const firstRerun = queue.rerunJob({
      jobId: original.id,
      userId: original.userId,
      idempotencyKey: "first-click",
      now: new Date(now.getTime() + 1_000),
    });
    queue.cancelJob({
      jobId: firstRerun.id,
      userId: firstRerun.userId,
      now: new Date(now.getTime() + 2_000),
    });

    const secondRerun = queue.rerunJob({
      jobId: original.id,
      userId: original.userId,
      idempotencyKey: "different-click",
      now: new Date(now.getTime() + 3_000),
    });

    expect(secondRerun.id).toBe(firstRerun.id);
    expect(secondRerun).toMatchObject({
      status: "queued",
      idempotencyKey: "simulation-rerun:sim_owner11_strategy",
      createdAt: new Date(now.getTime() + 3_000),
    });
    expect(queue.jobs()).toHaveLength(2);
  });

  it("preserves independent reruns for unrelated job types", () => {
    const queue = new InMemoryJobQueue();
    const original = queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { type: "draft-room-export", draftRoomId: "room_final" },
      idempotencyKey: "export:room-final",
      now,
    });
    queue.cancelJob({ jobId: original.id, userId: original.userId, now });

    const first = queue.rerunJob({
      jobId: original.id,
      userId: original.userId,
      idempotencyKey: "first-click",
    });
    const second = queue.rerunJob({
      jobId: original.id,
      userId: original.userId,
      idempotencyKey: "second-click",
    });

    expect(first.id).not.toBe(second.id);
    expect(queue.jobs()).toHaveLength(3);
  });
});

describe("job history", () => {
  it("returns compact newest-first pages with an opaque continuation cursor", () => {
    const queue = new InMemoryJobQueue();
    for (let index = 0; index < 55; index += 1) {
      queue.submit({
        userId: "user_owner11",
        leagueId: "league_100001",
        seasonId: "season_2026",
        kind: "export",
        inputJson: { index, privatePayload: "not-for-list-responses" },
        idempotencyKey: `export-${index}`,
        now: new Date(now.getTime() + index),
      });
    }

    const firstPage = queue.listPageForUser({ userId: "user_owner11", limit: 20 });
    expect(firstPage.jobs).toHaveLength(20);
    expect(firstPage.jobs[0]?.id).toBe(queue.jobs()[54]?.id);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    expect(firstPage.jobs[0]).not.toHaveProperty("inputJson");
    expect(firstPage.jobs[0]).not.toHaveProperty("resultSummary");

    const secondPage = queue.listPageForUser({
      userId: "user_owner11",
      limit: 20,
      cursor: firstPage.nextCursor,
    });
    expect(secondPage.jobs).toHaveLength(20);
    expect(new Set([...firstPage.jobs, ...secondPage.jobs].map(job => job.id)).size).toBe(40);
    expect(secondPage.nextCursor).toEqual(expect.any(String));
  });

  it("retains a bounded terminal history per account without deleting active jobs", () => {
    const queue = new InMemoryJobQueue();
    const active = queue.submit({
      userId: "user_owner11",
      leagueId: "league_100001",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { active: true },
      idempotencyKey: "active-export",
      now,
    });
    for (let index = 0; index < maximumRetainedTerminalJobsPerUser + 10; index += 1) {
      const job = queue.submit({
        userId: "user_owner11",
        leagueId: "league_100001",
        seasonId: "season_2026",
        kind: "export",
        inputJson: { index },
        idempotencyKey: `terminal-export-${index}`,
        now: new Date(now.getTime() + index + 1),
      });
      queue.cancelJob({ jobId: job.id, userId: job.userId });
    }

    expect(queue.jobs().filter(job => job.userId === active.userId && job.status === "canceled"))
      .toHaveLength(maximumRetainedTerminalJobsPerUser);
    expect(queue.fetchForUser(active.id, active.userId)).toBe(active);
  });
});
