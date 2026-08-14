import { describe, expect, it } from "vitest";
import { InMemoryJobQueue } from "../../src/platform/jobs.js";
import { runPlatformWorkerLoop } from "../../src/platform/platformWorker.js";

describe("platform worker polling errors", () => {
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
