import { describe, expect, it } from "vitest";
import { maximumRetainedSimulationRunsPerUser } from "../src/platform/simulationLimits.js";
import { InMemorySimulationRepository, SimulationError } from "../src/platform/simulations.js";

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
  it("retains only the newest bounded history and rejects an all-active backlog", () => {
    const repository = new InMemorySimulationRepository();
    for (let index = 0; index < maximumRetainedSimulationRunsPerUser + 1; index += 1) {
      const run = repository.createRequest({
        ...requestInput(`terminal-${index}`),
        createdAt: new Date(now.getTime() + index),
      });
      repository.markFailed(run.id);
    }
    const retained = repository.listForUser("user_cam", maximumRetainedSimulationRunsPerUser);
    expect(retained).toHaveLength(maximumRetainedSimulationRunsPerUser);
    expect(retained.map(run => run.request.idempotencyKey)).not.toContain("terminal-0");

    const activeRepository = new InMemorySimulationRepository();
    for (let index = 0; index < maximumRetainedSimulationRunsPerUser; index += 1) {
      activeRepository.createRequest(requestInput(`active-${index}`));
    }
    expect(() => activeRepository.createRequest(requestInput("active-over-cap"))).toThrow(
      new SimulationError(
        "simulation_capacity_reached",
        "Finish or cancel an active simulation before starting another one.",
      ),
    );
  });

  it("rejects completion from a superseded simulation execution", () => {
    const repository = new InMemorySimulationRepository();
    const run = repository.createRequest(requestInput("execution-fence"));
    const firstClaimedAt = new Date(now.getTime() + 1_000);
    const secondClaimedAt = new Date(now.getTime() + 2_000);
    repository.markRunning(run.id, firstClaimedAt);
    repository.markRunning(run.id, secondClaimedAt);

    expect(() => repository.complete(run.id, {
      runId: run.id,
      requestId: run.request.id,
      completedAt: firstClaimedAt,
      runCount: run.request.count,
      seedPrefix: run.request.seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: {
        runCount: run.request.count,
        scenarios: [],
        players: [],
        owners: [],
        ownerPlayerExposure: [],
      },
    }, firstClaimedAt)).toThrow("superseded by a newer execution");
    repository.markFailed(run.id, firstClaimedAt);
    expect(repository.find(run.id)).toMatchObject({ status: "running", startedAt: secondClaimedAt });
  });
});
