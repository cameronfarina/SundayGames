import { describe, expect, it } from "vitest";
import type { ForcedAuctionSale, MockBatch } from "../src/modeling/mockBatch.js";
import {
  InMemorySimulationRepository,
  SimulationError,
  canReadSimulationRun,
  executeSimulationRun,
  forcedSalesForSimulationRequest,
} from "../src/platform/simulations.js";

const now = new Date("2026-08-09T16:00:00.000Z");

const baseRequestInput = {
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix: "owner11-balanced-rb3",
  idempotencyKey: "balanced-rb3",
  strategy: {
    hardLocks: [
      {
        playerName: "Jadarian Price",
        price: 13,
        priceMode: "exact",
        auctionOwner: "Owner11",
      },
    ],
    softTargets: [
      {
        label: "good-not-elite-rb2",
        candidatePool: ["Breece Hall", "Kenneth Walker III", "Chase Brown"],
        maxBid: 35,
      },
      {
        label: "value-wrs",
        candidatePool: ["Davante Adams", "Zay Flowers", "Tee Higgins", "Ladd McConkey"],
        maxBid: 22,
      },
    ],
  },
} as const;

const fakeBatch = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}: {
  runsPerScenario: number;
  seedPrefix: string;
  forcedSales: readonly ForcedAuctionSale[];
}): MockBatch => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

describe("private simulation runs", () => {
  it("creates simulation requests idempotently for the same user league season and key", () => {
    const repository = new InMemorySimulationRepository();

    const firstRun = repository.createRequest({ ...baseRequestInput, createdAt: now });
    const secondRun = repository.createRequest({
      ...baseRequestInput,
      createdAt: new Date(now.getTime() + 1_000),
    });

    expect(secondRun).toBe(firstRun);
    expect(firstRun).toMatchObject({
      id: expect.stringMatching(/^sim_/),
      request: {
        userId: "user_cam",
        leagueId: "league_100001",
        seasonId: "season_2026",
        ownerId: "owner_cam",
        teamId: "team_cam",
        count: 25,
        seedPrefix: "owner11-balanced-rb3",
        idempotencyKey: "balanced-rb3",
        createdAt: now,
        privacyOwnerUserId: "user_cam",
      },
      status: "requested",
      createdAt: now,
      result: undefined,
    });
    expect(repository.listForUser("user_cam")).toEqual([firstRun]);
  });

  it("rejects an idempotency key reused with different simulation input", () => {
    const repository = new InMemorySimulationRepository();

    repository.createRequest({ ...baseRequestInput, createdAt: now });

    expect(() =>
      repository.createRequest({
        ...baseRequestInput,
        count: 24,
        createdAt: new Date(now.getTime() + 1_000),
      }),
    ).toThrow(new SimulationError(
      "idempotency_conflict",
      "A simulation request already exists for this idempotency key with different input.",
    ));
  });

  it("maps hard locks to forced sales and persists a runner result summary", async () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest({
      ...baseRequestInput,
      strategy: {
        hardLocks: [
          {
            playerName: "Jadarian Price",
            price: 13,
            priceMode: "exact",
            auctionOwner: "Owner11",
          },
          {
            playerName: "Kenneth Walker III",
            price: 30,
            priceMode: "ceiling",
            auctionOwner: "Owner11",
          },
        ],
        softTargets: baseRequestInput.strategy.softTargets,
      },
      createdAt: now,
    });
    const runnerCalls: Array<{
      runsPerScenario: number;
      seedPrefix: string;
      forcedSales: readonly ForcedAuctionSale[];
    }> = [];

    const completedRun = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCalls.push(options);
        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 5_000),
    });

    expect(runnerCalls).toEqual([
      expect.objectContaining({
        runsPerScenario: 25,
        seedPrefix: "owner11-balanced-rb3",
        forcedSales: [
          { owner: "Owner11", player: "Jadarian Price", price: 13 },
          { owner: "Owner11", player: "Kenneth Walker III", price: 30 },
        ],
        hardLocks: [
          {
            playerName: "Jadarian Price",
            price: 13,
            priceMode: "exact",
            auctionOwner: "Owner11",
          },
          {
            playerName: "Kenneth Walker III",
            price: 30,
            priceMode: "ceiling",
            auctionOwner: "Owner11",
          },
        ],
        softTargets: [
          {
            label: "good-not-elite-rb2",
            candidatePool: ["Breece Hall", "Kenneth Walker III", "Chase Brown"],
            maxBid: 35,
          },
          {
            label: "value-wrs",
            candidatePool: ["Davante Adams", "Zay Flowers", "Tee Higgins", "Ladd McConkey"],
            maxBid: 22,
          },
        ],
      }),
    ]);
    expect(completedRun.status).toBe("completed");
    expect(completedRun.result).toMatchObject({
      runId: run.id,
      requestId: run.request.id,
      runCount: 25,
      seedPrefix: "owner11-balanced-rb3",
      hardLockCount: 2,
      softTargetCount: 2,
      forcedSales: [
        { owner: "Owner11", player: "Jadarian Price", price: 13 },
        { owner: "Owner11", player: "Kenneth Walker III", price: 30 },
      ],
      summary: {
        runCount: 25,
      },
    });
    expect(repository.fetchForUser(run.id, "user_cam")?.result).toBe(completedRun.result);
  });

  it("only lets the private owner list or read their simulation results", async () => {
    const repository = new InMemorySimulationRepository();
    const camRun = repository.createRequest({ ...baseRequestInput, createdAt: now });
    const otherRun = repository.createRequest({
      ...baseRequestInput,
      userId: "user_other",
      ownerId: "owner_other",
      teamId: "team_other",
      idempotencyKey: "other-balanced-rb3",
      createdAt: now,
    });

    await executeSimulationRun({
      repository,
      runId: camRun.id,
      runner: options => fakeBatch(options),
      now: new Date(now.getTime() + 5_000),
    });
    await executeSimulationRun({
      repository,
      runId: otherRun.id,
      runner: options => fakeBatch(options),
      now: new Date(now.getTime() + 6_000),
    });

    expect(canReadSimulationRun("user_cam", camRun)).toBe(true);
    expect(canReadSimulationRun("user_other", camRun)).toBe(false);
    expect(repository.listForUser("user_cam").map(candidate => candidate.id)).toEqual([camRun.id]);
    expect(repository.fetchForUser(camRun.id, "user_other")).toBeNull();
    expect(repository.fetchForUser(camRun.id, "user_cam")).toBe(camRun);
  });

  it("validates run count, hard-lock players, prices, and duplicate hard locks", () => {
    const repository = new InMemorySimulationRepository();

    expect(() => repository.createRequest({
      ...baseRequestInput,
      count: 0,
      createdAt: now,
    })).toThrow(new SimulationError("invalid_count", "Simulation count must be at least 1."));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      count: 101,
      createdAt: now,
    })).toThrow(new SimulationError("invalid_count", "Simulation count cannot exceed 100."));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "missing-player",
      strategy: {
        hardLocks: [{ playerName: " ", price: 13, auctionOwner: "Owner11" }],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError("missing_hard_lock_player", "Hard locks must include a player name."));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "invalid-price",
      strategy: {
        hardLocks: [{ playerName: "Jadarian Price", price: 0, auctionOwner: "Owner11" }],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_hard_lock_price",
      "Hard lock for Jadarian Price must use a positive whole-dollar price.",
    ));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "duplicate-lock",
      strategy: {
        hardLocks: [
          { playerName: "Jadarian Price", price: 13, auctionOwner: "Owner11" },
          { playerName: " jadarian price ", price: 14, auctionOwner: "Owner11" },
        ],
        softTargets: [],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "duplicate_hard_lock",
      "Hard lock duplicates Jadarian Price.",
    ));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "empty-target-label",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: " ", candidatePool: ["Ladd McConkey"], maxBid: 21 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError("invalid_soft_target_label", "Soft targets must include a label."));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "empty-target-pool",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: "value WRs", candidatePool: [" "], maxBid: 21 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_soft_target_candidate_pool",
      "Soft target value WRs must include at least one candidate.",
    ));

    expect(() => repository.createRequest({
      ...baseRequestInput,
      idempotencyKey: "invalid-target-max",
      strategy: {
        hardLocks: [],
        softTargets: [{ label: "value WRs", candidatePool: ["Ladd McConkey"], maxBid: 0 }],
      },
      createdAt: now,
    })).toThrow(new SimulationError(
      "invalid_soft_target_max_bid",
      "Soft target value WRs must use a positive whole-dollar max bid.",
    ));
  });

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

    expect(runnerCalls).toEqual([
      expect.objectContaining({
        forcedSales: [],
        hardLocks: [
          {
            playerName: "Puka Nacua",
            price: 65,
            priceMode: "exact",
            auctionOwner: undefined,
          },
        ],
      }),
    ]);
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
    const completed = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCallCount += 1;

        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 2_000),
    });
    const completedAgain = await executeSimulationRun({
      repository,
      runId: run.id,
      runner: options => {
        runnerCallCount += 1;

        return fakeBatch(options);
      },
      now: new Date(now.getTime() + 3_000),
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
