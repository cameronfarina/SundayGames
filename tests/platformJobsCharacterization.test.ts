import { describe, expect, it } from "vitest";
import {
  InMemoryJobQueue,
  hashJobInput,
  sanitizeJobError,
} from "../src/platform/jobs.js";

describe("platform job characterization", () => {
  it("hashes equivalent nested JSON objects identically regardless of key order", () => {
    const firstHash = hashJobInput({
      filters: { position: "RB", team: undefined },
      iterations: 25,
      targets: ["Jahmyr Gibbs", "Ladd McConkey"],
    });
    const secondHash = hashJobInput({
      targets: ["Jahmyr Gibbs", "Ladd McConkey"],
      iterations: 25,
      filters: { team: undefined, position: "RB" },
    });

    expect(secondHash).toBe(firstHash);
  });

  it("leaves nonmatching jobs queued when a worker filters claimable kinds", () => {
    const queue = new InMemoryJobQueue();
    const submitted = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 25 },
      idempotencyKey: "simulation-25",
      now: new Date("2026-08-14T12:00:00.000Z"),
    });

    expect(queue.claimNextJob({ workerId: "import_worker", kinds: ["import"] })).toBeNull();
    expect(submitted.status).toBe("queued");
    expect(queue.claimNextJob({ workerId: "simulation_worker", kinds: ["simulation"] })).toBe(
      submitted,
    );
  });

  it("does not expose invalid or attacker-controlled error names", () => {
    const error = new Error("secret provider detail");
    error.name = "<script>alert(1)</script>";

    expect(sanitizeJobError(error)).toEqual({
      name: "Error",
      message: "Job failed. Check worker logs for details.",
    });
  });

  it("removes pruned terminal jobs from both storage and the idempotency index", () => {
    const queue = new InMemoryJobQueue();
    const start = new Date("2026-08-14T12:00:00.000Z");
    let firstJobId = "";

    for (let index = 0; index < 201; index += 1) {
      const now = new Date(start.getTime() + index);
      const job = queue.submit({
        userId: "user_cam",
        leagueId: "league_home",
        seasonId: "season_2026",
        kind: "export",
        inputJson: { index },
        idempotencyKey: `export-${index}`,
        now,
      });
      if (index === 0) firstJobId = job.id;
      queue.cancelJob({ jobId: job.id, userId: "user_cam", now });
    }

    expect(queue.listForUser("user_cam")).toHaveLength(200);
    expect(queue.fetchForUser(firstJobId, "user_cam")).toBeNull();

    const replacement = queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { index: 0 },
      idempotencyKey: "export-0",
      now: new Date(start.getTime() + 500),
    });

    expect(replacement.id).not.toBe(firstJobId);
  });
});
