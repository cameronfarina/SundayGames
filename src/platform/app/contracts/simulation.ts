import type { JobHistoryPage } from "../../jobHistory.js";
import type { JobRecord } from "../../jobs.js";
import type {
  CreateSimulationRequestInput,
  SimulationResult,
  SimulationRun,
} from "../../simulations.js";

export interface CreatePlatformSimulationRunInput extends Omit<
  CreateSimulationRequestInput,
  "userId" | "createdAt"
> {
  actorSessionToken: string;
  now?: Date | undefined;
}

export interface ExecutePlatformSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  now?: Date | undefined;
}

export interface CancelPlatformSimulationRunInput extends ExecutePlatformSimulationRunInput {}

export interface FindPlatformSimulationLaunchInput {
  actorSessionToken: string;
  seasonId: string;
  requestId: string;
  now?: Date | undefined;
}

export interface CompletePlatformSeasonSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  result: SimulationResult;
  now?: Date | undefined;
}

export interface ExecutePlatformSimulationRunForWorkerInput {
  runId: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  now?: Date | undefined;
}

export interface EnqueuePlatformSimulationRunJobInput {
  actorSessionToken: string;
  runId: string;
  idempotencyKey?: string | undefined;
  now?: Date | undefined;
}

export interface ListPlatformSimulationRunsInput {
  actorSessionToken: string;
  seasonId?: string | undefined;
  historyLimit?: number | undefined;
  now?: Date | undefined;
}

export interface GetPlatformSimulationRunInput {
  actorSessionToken: string;
  runId: string;
  now?: Date | undefined;
}

export interface SetPlatformSimulationOutcomeFavoriteInput extends GetPlatformSimulationRunInput {
  favorite: boolean;
  runNumber: number;
}

export interface ListPlatformJobsInput {
  actorSessionToken: string;
  cursor?: string | undefined;
  limit?: number | undefined;
  now?: Date | undefined;
}

export interface GetPlatformJobInput {
  actorSessionToken: string;
  jobId: string;
  now?: Date | undefined;
}

export interface CancelPlatformJobInput extends GetPlatformJobInput {}

export interface RerunPlatformJobInput extends GetPlatformJobInput {
  idempotencyKey: string;
}

export interface SimulationOperations {
  createSimulationRun(input: CreatePlatformSimulationRunInput): Promise<SimulationRun>;
  executeSimulationRun(input: ExecutePlatformSimulationRunInput): Promise<SimulationRun>;
  completeSeasonSimulationRun(input: CompletePlatformSeasonSimulationRunInput): Promise<SimulationRun>;
  cancelSimulationRun(input: CancelPlatformSimulationRunInput): Promise<SimulationRun>;
  findSimulationLaunch(input: FindPlatformSimulationLaunchInput): Promise<SimulationRun | null>;
  executeSimulationRunForWorker(input: ExecutePlatformSimulationRunForWorkerInput): Promise<SimulationRun>;
  listSimulationRuns(input: ListPlatformSimulationRunsInput): Promise<readonly SimulationRun[]>;
  getSimulationRun(input: GetPlatformSimulationRunInput): Promise<SimulationRun>;
  setSimulationOutcomeFavorite(
    input: SetPlatformSimulationOutcomeFavoriteInput,
  ): Promise<SimulationRun>;
  enqueueSimulationRunExecutionJob(input: EnqueuePlatformSimulationRunJobInput): Promise<JobRecord>;
  listJobs(input: ListPlatformJobsInput): Promise<JobHistoryPage>;
  getJob(input: GetPlatformJobInput): Promise<JobRecord>;
  cancelJob(input: CancelPlatformJobInput): Promise<JobRecord>;
  rerunJob(input: RerunPlatformJobInput): Promise<JobRecord>;
}
