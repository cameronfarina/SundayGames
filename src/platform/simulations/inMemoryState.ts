import { simulationIdempotencyIndexKey } from "./keys.js";
import type { SimulationRun } from "./runContracts.js";

export class InMemorySimulationState {
  readonly #runsById = new Map<string, SimulationRun>();
  readonly #runIdsByIdempotencyKey = new Map<string, string>();

  constructor(runs: readonly SimulationRun[]) {
    this.replace(runs);
  }

  values(): SimulationRun[] {
    return [...this.#runsById.values()];
  }

  get(runId: string): SimulationRun | undefined {
    return this.#runsById.get(runId);
  }

  getByIdempotencyKey(key: string): SimulationRun | undefined {
    const runId = this.#runIdsByIdempotencyKey.get(key);
    return runId === undefined ? undefined : this.#runsById.get(runId);
  }

  store(run: SimulationRun): void {
    this.#runsById.set(run.id, run);
    this.#runIdsByIdempotencyKey.set(
      simulationIdempotencyIndexKey(
        run.request.userId,
        run.request.leagueId,
        run.request.seasonId,
        run.request.idempotencyKey,
      ),
      run.id,
    );
  }

  delete(run: SimulationRun): void {
    this.#runsById.delete(run.id);
    this.#runIdsByIdempotencyKey.delete(simulationIdempotencyIndexKey(
      run.request.userId,
      run.request.leagueId,
      run.request.seasonId,
      run.request.idempotencyKey,
    ));
  }

  replace(runs: readonly SimulationRun[]): void {
    this.#runsById.clear();
    this.#runIdsByIdempotencyKey.clear();
    for (const run of runs) this.store(structuredClone(run));
  }
}
