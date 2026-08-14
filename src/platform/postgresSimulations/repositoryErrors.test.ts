import { describe, expect, it } from "vitest";
import type { SimulationResult } from "../simulations.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../postgresPlatformStore.js";
import { PostgresSimulationRepository } from "./repository.js";

class EmptyClient implements PostgresTransactionalQueryClient {
  async query<TRow = Record<string, unknown>>(): Promise<PostgresQueryResult<TRow>> {
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await operation(this);
  }
}

const completedResult: SimulationResult = {
  runId: "missing",
  requestId: "missing",
  completedAt: new Date("2026-08-09T16:00:00.000Z"),
  runCount: 1,
  seedPrefix: "missing",
  hardLockCount: 0,
  softTargetCount: 0,
  forcedSales: [],
  summary: {
    runCount: 1,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
};

describe("Postgres simulation missing-run errors", () => {
  it.each([
    ["find", (repository: PostgresSimulationRepository) => repository.find("missing")],
    ["mark running", (repository: PostgresSimulationRepository) =>
      repository.markRunning("missing", completedResult.completedAt)],
    ["mark failed", (repository: PostgresSimulationRepository) =>
      repository.markFailed("missing")],
    ["cancel", (repository: PostgresSimulationRepository) =>
      repository.markCanceled("missing")],
    ["reset", (repository: PostgresSimulationRepository) =>
      repository.resetForRerun("missing")],
    ["complete", (repository: PostgresSimulationRepository) =>
      repository.complete("missing", completedResult)],
  ])("returns the domain error when %s cannot find a run", async (_label, operation) => {
    const repository = new PostgresSimulationRepository(new EmptyClient());
    await expect(operation(repository)).rejects.toMatchObject({
      code: "simulation_not_found",
      message: "Simulation run was not found.",
    });
  });
});
