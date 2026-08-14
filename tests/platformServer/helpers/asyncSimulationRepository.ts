import {
  InMemorySimulationRepository,
  type CreateSimulationRequestInput,
  type SimulationRepository,
  type SimulationResult,
  type SimulationRun,
} from "../../../src/platform/simulations.js";

export class AsyncSimulationRepository implements SimulationRepository {
  readonly inner = new InMemorySimulationRepository();

  async createRequest(input: CreateSimulationRequestInput): Promise<SimulationRun> {
    return this.inner.createRequest(input);
  }

  async listForUser(userId: string): Promise<SimulationRun[]> {
    return this.inner.listForUser(userId);
  }

  async listHistoryForUserSeason(userId: string, seasonId: string, limit: number): Promise<SimulationRun[]> {
    return this.inner.listHistoryForUserSeason(userId, seasonId, limit);
  }

  async fetchForUser(runId: string, userId: string): Promise<SimulationRun | null> {
    return this.inner.fetchForUser(runId, userId);
  }

  async find(runId: string): Promise<SimulationRun> {
    return this.inner.find(runId);
  }

  async markRunning(runId: string, runAt: Date): Promise<SimulationRun> {
    return this.inner.markRunning(runId, runAt);
  }

  async markFailed(runId: string): Promise<SimulationRun> {
    return this.inner.markFailed(runId);
  }

  async markCanceled(runId: string): Promise<SimulationRun> {
    return this.inner.markCanceled(runId);
  }

  async resetForRerun(runId: string): Promise<SimulationRun> {
    return this.inner.resetForRerun(runId);
  }

  async complete(runId: string, result: SimulationResult): Promise<SimulationRun> {
    return this.inner.complete(runId, result);
  }
}
