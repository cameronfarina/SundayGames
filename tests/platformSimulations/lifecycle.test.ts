import { describe, expect, it } from "vitest";
import {
  InMemorySimulationRepository,
  executeSimulationRun,
  forcedSalesForSimulationRequest,
} from "../../src/platform/simulations.js";
import { baseRequestInput, fakeBatch, now } from "./support.js";

describe("private simulation lifecycle", () => {
  it("keeps hard locks without an auction owner private and passes them to the runner constraints", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "planning-only-lock",
      strategy: {
        hardLocks: [{ playerName: "Puka Nacua", price: 65 }],
        softTargets: [],
      },
      createdAt: now,
    });
    expect(forcedSalesForSimulationRequest(run.request)).toEqual([]);

    const runnerCalls: unknown[] = [];
    await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCalls.push(options);
        return fakeBatch(options);
      },
      now,
    });
    expect(runnerCalls).toEqual([expect.objectContaining({
      forcedSales: [],
      hardLocks: [{
        playerName: "Puka Nacua",
        price: 65,
        priceMode: "exact",
        auctionOwner: undefined,
      }],
    })]);
  });

  it("marks runner failures and returns completed runs idempotently", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "failure-then-idempotent-completion",
      createdAt: now,
    });
    await expect(executeSimulationRun({
      repository,
      runId: run.id,
      runner: () => {
        throw new Error("runner unavailable");
      },
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow("runner unavailable");
    expect(repository.find(run.id).status).toBe("failed");

    let runnerCallCount = 0;
    const runner = (options: Parameters<typeof fakeBatch>[0]) => {
      runnerCallCount += 1;
      return fakeBatch(options);
    };
    const completed = await executeSimulationRun({
      repository, runId: run.id, runner, now: new Date(now.getTime() + 2_000),
    });
    const completedAgain = await executeSimulationRun({
      repository, runId: run.id, runner, now: new Date(now.getTime() + 3_000),
    });
    expect(completedAgain).toBe(completed);
    expect(runnerCallCount).toBe(1);
    expect(repository.find(run.id).status).toBe("completed");
  });

  it("keeps canceled simulation runs from persisting stale completion results", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "cancel-before-runner-completes",
      createdAt: now,
    });
    repository.markRunning(run.id, new Date(now.getTime() + 1_000));
    repository.markCanceled(run.id);
    let runnerCallCount = 0;
    const canceledRun = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCallCount += 1;
        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 2_000),
    });
    const attemptedCompletion = repository.complete(run.id, {
      runId: run.id,
      requestId: run.request.id,
      completedAt: new Date(now.getTime() + 3_000),
      runCount: 25,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: run.request.strategy.hardLocks.length,
      softTargetCount: run.request.strategy.softTargets.length,
      forcedSales: [],
      summary: fakeBatch({
        runsPerScenario: 25,
        seedPrefix: run.request.seedPrefix,
        forcedSales: [],
      }).summary,
    });

    expect(runnerCallCount).toBe(0);
    expect(canceledRun).toBe(run);
    expect(attemptedCompletion).toBe(run);
    expect(repository.find(run.id)).toMatchObject({
      status: "canceled",
      completedAt: undefined,
      result: undefined,
    });
  });
});
