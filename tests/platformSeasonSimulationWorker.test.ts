import { describe, expect, it, vi } from "vitest";

import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
} from "../src/platform/leagueSeason.js";
import {
  currentLeagueInitialRostersFor,
  loadCurrentPlayerCatalog,
} from "../src/platform/localDemoFixtures.js";
import { SeasonSimulationError } from "../src/platform/seasonSimulationEngine.js";
import { runSeasonSimulations } from "../src/platform/seasonSimulationEngine.js";
import {
  createBoundedSeasonSimulationRunner,
  createNodeSeasonSimulationRunner,
} from "../src/platform/seasonSimulationWorkerRunner.js";

const now = new Date("2026-08-11T12:00:00.000Z");

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve;
  });

  return { promise, resolve };
};

const simulationInput = async () => {
  const season = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Worker test league",
    setupStatus: "published",
  });

  return {
    season,
    setup: {
      seasonId: season.id,
      sourceVersion: "worker-test",
      playerCatalog: await loadCurrentPlayerCatalog(),
      initialRosters: currentLeagueInitialRostersFor(season),
      contentHash: "worker-test-hash",
      updatedAt: now,
    },
    humanTeamId: season.teams[0]?.id ?? "missing",
    runCount: 1,
    strategyInput: "Target Puka Nacua for no more than $80",
    seedPrefix: "worker-test",
  };
};

describe("season simulation worker runner", () => {
  it("runs a complete simulation outside the caller thread", async () => {
    const runner = createNodeSeasonSimulationRunner({ maxConcurrent: 1 });

    await expect(runner(await simulationInput())).resolves.toMatchObject({
      draftFormat: "auction",
      runCount: 1,
      completedCount: 1,
      seedPrefix: "worker-test",
      targetOutcome: {
        playerName: "Puka Nacua",
      },
    });
  });

  it("forwards completed-draft progress from the worker", async () => {
    const runner = createNodeSeasonSimulationRunner({ maxConcurrent: 1 });
    const progress: Array<{ completed: number; total: number }> = [];

    await runner({ ...await simulationInput(), runCount: 3 }, {
      onProgress: update => progress.push(update),
    });

    expect(progress).toEqual([
      { completed: 1, total: 3 },
      { completed: 2, total: 3 },
      { completed: 3, total: 3 },
    ]);
  });

  it("preserves domain errors returned by a worker", async () => {
    const runner = createNodeSeasonSimulationRunner({ maxConcurrent: 1 });

    await expect(runner({
      ...await simulationInput(),
      humanTeamId: "missing-team",
    })).rejects.toMatchObject({
      name: SeasonSimulationError.name,
      code: "human_team_missing",
    });
  });

  it("caps pending work and removes a canceled request before it starts", async () => {
    const firstStarted = deferred();
    const releaseFirst = deferred();
    let executionCount = 0;
    const runner = createBoundedSeasonSimulationRunner(async (input, options) => {
      executionCount += 1;
      firstStarted.resolve();
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(new SeasonSimulationError("simulation_canceled", "Canceled."));
        options?.signal?.addEventListener("abort", abort, { once: true });
        releaseFirst.promise.then(resolve, reject);
      });
      return runSeasonSimulations({ ...input, runCount: 1 });
    }, {
      maxConcurrent: 1,
      maxPending: 1,
      timeoutMs: 5_000,
    });
    const input = await simulationInput();
    const first = runner(input);
    await firstStarted.promise;
    const secondAbort = new AbortController();
    const second = runner(input, { signal: secondAbort.signal });

    await expect(runner(input)).rejects.toMatchObject({ code: "simulation_busy" });
    secondAbort.abort();
    await expect(second).rejects.toMatchObject({ code: "simulation_canceled" });
    expect(executionCount).toBe(1);

    releaseFirst.resolve();
    await expect(first).resolves.toMatchObject({ completedCount: 1 });
  });

  it("reserves queue capacity for a second account", async () => {
    const release = deferred();
    let executionCount = 0;
    const runner = createBoundedSeasonSimulationRunner(async input => {
      executionCount += 1;
      await release.promise;
      return runSeasonSimulations({ ...input, runCount: 1 });
    }, {
      maxConcurrent: 2,
      maxOutstandingPerAccount: 4,
      maxPending: 8,
      timeoutMs: 5_000,
    });
    const input = await simulationInput();
    const accountARequests = Array.from(
      { length: 4 },
      () => runner(input, { accountId: "account-a" }),
    );

    await vi.waitFor(() => expect(executionCount).toBe(2));
    await expect(runner(input, { accountId: "account-a" })).rejects.toMatchObject({
      code: "simulation_account_queue_full",
    });
    const accountBRequest = runner(input, { accountId: "account-b" });

    release.resolve();
    await expect(Promise.all([...accountARequests, accountBRequest])).resolves.toHaveLength(5);
    expect(executionCount).toBe(5);
    await expect(runner(input, { accountId: "account-a" })).resolves.toMatchObject({
      completedCount: 1,
    });
    expect(executionCount).toBe(6);
  }, 15_000);

  it("times out active work and releases its worker slot", async () => {
    const runner = createBoundedSeasonSimulationRunner(async (_input, options) =>
      await new Promise((_, reject) => {
        options?.signal?.addEventListener("abort", () => reject(
          new SeasonSimulationError("simulation_canceled", "Canceled."),
        ), { once: true });
      }), {
      maxConcurrent: 1,
      maxPending: 1,
      timeoutMs: 10,
    });

    await expect(runner(await simulationInput())).rejects.toMatchObject({
      code: "simulation_timeout",
    });
  });

  it("allows production-sized work to run beyond the old 30-second cutoff", async () => {
    const input = await simulationInput();
    const started = deferred();
    const release = deferred();
    vi.useFakeTimers();

    try {
      const runner = createBoundedSeasonSimulationRunner(async () => {
        started.resolve();
        await release.promise;
        return runSeasonSimulations({ ...input, runCount: 1 });
      }, {
        maxConcurrent: 1,
        maxPending: 1,
      });
      const result = runner(input);
      await started.promise;

      await vi.advanceTimersByTimeAsync(30_001);
      release.resolve();

      await expect(result).resolves.toMatchObject({ completedCount: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
