import type {
  CreateSimulationRequestInput,
  SimulationRepository,
  SimulationResult,
  SimulationRun,
} from "../simulations.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { markFailed, markRunning } from "./basicTransitions.js";
import { complete } from "./complete.js";
import { createRequest } from "./createRequest.js";
import { fetchForUser, listForUser, listHistoryForUserSeason } from "./history.js";
import { findByRequestKeyForUser, findRequired } from "./lookups.js";
import { markCanceled, resetForRerun } from "./resetCancel.js";
import { setOutcomeFavorite } from "./outcomeFavorites.js";
import { reconcileAbandoned } from "./reconcile.js";
import type { SimulationRepositoryContext } from "./types.js";

export class PostgresSimulationRepository implements SimulationRepository {
  readonly #context: SimulationRepositoryContext;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#context = { client };
  }

  async createRequest(input: CreateSimulationRequestInput): Promise<SimulationRun> {
    return await createRequest(this.#context, input);
  }

  async listForUser(userId: string, limit?: number): Promise<SimulationRun[]> {
    return await listForUser(this.#context.client, userId, limit);
  }

  async listHistoryForUserSeason(
    userId: string, seasonId: string, limit: number,
  ): Promise<SimulationRun[]> {
    return await listHistoryForUserSeason(this.#context.client, userId, seasonId, limit);
  }

  async fetchForUser(runId: string, userId: string): Promise<SimulationRun | null> {
    return await fetchForUser(this.#context.client, runId, userId);
  }

  async findByRequestKeyForUser(
    userId: string,
    seasonId: string,
    idempotencyKey: string,
  ): Promise<SimulationRun | null> {
    return await findByRequestKeyForUser(
      userId,
      seasonId,
      idempotencyKey,
      this.#context.client,
    );
  }

  async reconcileAbandoned(now: Date): Promise<void> {
    await reconcileAbandoned(this.#context, now);
  }

  async find(runId: string): Promise<SimulationRun> {
    return await findRequired(runId, this.#context.client);
  }

  async markRunning(runId: string, now: Date): Promise<SimulationRun> {
    return await markRunning(this.#context, runId, now);
  }

  async markFailed(runId: string): Promise<SimulationRun> {
    return await markFailed(this.#context, runId);
  }

  async markCanceled(runId: string): Promise<SimulationRun> {
    return await markCanceled(this.#context, runId);
  }

  async resetForRerun(runId: string): Promise<SimulationRun> {
    return await resetForRerun(this.#context, runId);
  }

  async complete(runId: string, result: SimulationResult): Promise<SimulationRun> {
    return await complete(this.#context, runId, result);
  }

  async setOutcomeFavorite(
    runId: string,
    runNumber: number,
    favorite: boolean,
  ): Promise<SimulationRun> {
    return await setOutcomeFavorite(this.#context, runId, runNumber, favorite);
  }
}
