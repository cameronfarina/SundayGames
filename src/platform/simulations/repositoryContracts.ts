import type {
  CreateSimulationRequestInput,
  SimulationMockBatchRunner,
  SimulationResult,
  SimulationRun,
} from "./runContracts.js";

type MaybePromise<T> = T | Promise<T>;

export interface SimulationRepository {
  createRequest(input: CreateSimulationRequestInput): MaybePromise<SimulationRun>;
  listForUser(userId: string, limit?: number): MaybePromise<SimulationRun[]>;
  listHistoryForUserSeason(
    userId: string,
    seasonId: string,
    limit: number,
  ): MaybePromise<SimulationRun[]>;
  fetchForUser(runId: string, userId: string): MaybePromise<SimulationRun | null>;
  find(runId: string): MaybePromise<SimulationRun>;
  markRunning(runId: string, now: Date): MaybePromise<SimulationRun>;
  markFailed(runId: string): MaybePromise<SimulationRun>;
  markCanceled(runId: string): MaybePromise<SimulationRun>;
  resetForRerun(runId: string): MaybePromise<SimulationRun>;
  complete(runId: string, result: SimulationResult): MaybePromise<SimulationRun>;
}

export interface ExecuteSimulationRunInput {
  repository: SimulationRepository;
  runId: string;
  runner: SimulationMockBatchRunner;
  now?: Date | undefined;
}
