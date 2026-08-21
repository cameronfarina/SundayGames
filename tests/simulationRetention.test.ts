import { describe, expect, it } from "vitest";
import { maximumRetainedSimulationRunsPerUser } from "../src/platform/simulationLimits.js";
import { InMemorySimulationRepository } from "../src/platform/simulations.js";

const now = new Date("2026-08-13T18:00:00.000Z");

const requestInput = (idempotencyKey: string) => ({
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  ownerId: "owner_cam",
  teamId: "team_cam",
  count: 25,
  seedPrefix: "balanced",
  idempotencyKey,
  strategy: {},
  createdAt: now,
});

describe("simulation retention", () => {
  it("retains completed history without making abandoned launches an admission cap", () => {
    const repository = new InMemorySimulationRepository();
    for (let index = 0; index < maximumRetainedSimulationRunsPerUser + 1; index += 1) {
      const run = repository.createRequest({
        ...requestInput(`terminal-${index}`),
        createdAt: new Date(now.getTime() + index),
      });
      repository.complete(run.id, {
        runId: run.id,
        requestId: run.request.id,
        completedAt: new Date(now.getTime() + index),
        runCount: 25,
        seedPrefix: "balanced",
        hardLockCount: 0,
        softTargetCount: 0,
        forcedSales: [],
        summary: { runCount: 25, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
      });
    }
    const retained = repository.listForUser("user_cam", maximumRetainedSimulationRunsPerUser);
    expect(retained).toHaveLength(maximumRetainedSimulationRunsPerUser);
    expect(retained.map(run => run.request.idempotencyKey)).not.toContain("terminal-0");

    const activeRepository = new InMemorySimulationRepository();
    for (let index = 0; index < maximumRetainedSimulationRunsPerUser; index += 1) {
      activeRepository.createRequest(requestInput(`active-${index}`));
    }
    expect(() => activeRepository.createRequest(requestInput("active-over-cap"))).not.toThrow();
    expect(activeRepository.runs()).toHaveLength(maximumRetainedSimulationRunsPerUser + 1);

    activeRepository.createRequest({
      ...requestInput("after-expiry"),
      createdAt: new Date(now.getTime() + 2 * 60 * 60 * 1_000),
    });
    expect(activeRepository.runs().map(run => run.request.idempotencyKey))
      .toEqual(["after-expiry"]);

    activeRepository.reconcileAbandoned(new Date(now.getTime() + 4 * 60 * 60 * 1_000));
    expect(activeRepository.runs()).toEqual([]);
  });

  it("keeps the first terminal transition when cancel and completion race", () => {
    const repository = new InMemorySimulationRepository();
    const canceled = repository.createRequest(requestInput("cancel-first"));
    repository.markCanceled(canceled.id);
    repository.complete(canceled.id, {
      runId: canceled.id,
      requestId: canceled.request.id,
      completedAt: now,
      runCount: 25,
      seedPrefix: "balanced",
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount: 25, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    });
    expect(repository.find(canceled.id)).toMatchObject({ status: "canceled", result: undefined });

    const completed = repository.createRequest(requestInput("complete-first"));
    repository.complete(completed.id, {
      runId: completed.id,
      requestId: completed.request.id,
      completedAt: now,
      runCount: 25,
      seedPrefix: "balanced",
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount: 25, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
    });
    repository.markCanceled(completed.id);
    expect(repository.find(completed.id)).toMatchObject({ status: "completed" });
  });
});
