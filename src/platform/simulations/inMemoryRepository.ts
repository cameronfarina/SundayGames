import { SimulationError } from "./errors.js";
import { createInMemorySimulationRequest } from "./inMemoryCreation.js";
import {
  listInMemorySimulationHistoryForSeason,
  listInMemorySimulationsForUser,
} from "./inMemoryHistory.js";
import { InMemorySimulationState } from "./inMemoryState.js";
import { canReadSimulationRun } from "./privacy.js";
import { resultWithOutcomeFavorite } from "./outcomeFavorites.js";
import type { SimulationRepository } from "./repositoryContracts.js";
import type {
  CreateSimulationRequestInput,
  SimulationResult,
  SimulationRun,
} from "./runContracts.js";

export class InMemorySimulationRepository implements SimulationRepository {
  readonly #state: InMemorySimulationState;

  constructor(runs: readonly SimulationRun[] = []) {
    this.#state = new InMemorySimulationState(runs);
  }

  createRequest(input: CreateSimulationRequestInput): SimulationRun {
    return createInMemorySimulationRequest(this.#state, input);
  }

  listForUser(userId: string, limit?: number): SimulationRun[] {
    return listInMemorySimulationsForUser(this.#state, userId, limit);
  }

  listHistoryForUserSeason(userId: string, seasonId: string, limit: number): SimulationRun[] {
    return listInMemorySimulationHistoryForSeason(this.#state, userId, seasonId, limit);
  }

  fetchForUser(runId: string, userId: string): SimulationRun | null {
    const run = this.#state.get(runId);
    return run === undefined || !canReadSimulationRun(userId, run) ? null : run;
  }

  find(runId: string): SimulationRun {
    const run = this.#state.get(runId);
    if (run === undefined) {
      throw new SimulationError("simulation_not_found", "Simulation run was not found.");
    }
    return run;
  }

  markRunning(runId: string, now: Date): SimulationRun {
    const run = this.find(runId);
    run.status = "running";
    run.startedAt = now;
    return run;
  }

  markFailed(runId: string): SimulationRun {
    const run = this.find(runId);
    if (run.status !== "canceled") run.status = "failed";
    return run;
  }

  markCanceled(runId: string): SimulationRun {
    const run = this.find(runId);
    if (run.status === "completed") return run;
    run.status = "canceled";
    run.result = undefined;
    run.completedAt = undefined;
    return run;
  }

  resetForRerun(runId: string): SimulationRun {
    const run = this.find(runId);
    if (run.status === "running") return run;
    run.status = "requested";
    run.startedAt = undefined;
    run.completedAt = undefined;
    run.result = undefined;
    return run;
  }

  complete(runId: string, result: SimulationResult): SimulationRun {
    const run = this.find(runId);
    if (run.status === "canceled") return run;
    run.status = "completed";
    run.completedAt = result.completedAt;
    run.result = result;
    return run;
  }

  setOutcomeFavorite(runId: string, runNumber: number, favorite: boolean): SimulationRun {
    const run = this.find(runId);
    run.result = resultWithOutcomeFavorite(run.result, runNumber, favorite);
    return run;
  }

  runs(): SimulationRun[] {
    return this.#state.values().map(run => structuredClone(run));
  }

  replaceRuns(runs: readonly SimulationRun[]): void {
    this.#state.replace(runs);
  }
}
