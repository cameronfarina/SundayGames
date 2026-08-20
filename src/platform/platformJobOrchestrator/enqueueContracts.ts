import type { JsonObject } from "../jobs.js";
import type { SeasonSimulationExecutionJobInput } from "./payloads.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import type {
  DraftRoomExportFormat,
  PricingRebuildReason,
} from "./platformJobTypes.js";

export interface EnqueuePlatformJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> {
  repository: TRepository;
  userId: string;
  leagueId: string;
  seasonId: string;
  idempotencyKey?: string | undefined;
  maxAttempts?: number | undefined;
  now?: Date | undefined;
}

export interface EnqueueSimulationRunExecutionJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> extends EnqueuePlatformJobInput<TRepository> {
  simulationRunId: string;
  runCount: number;
  modelRunId?: string | undefined;
  keeperScenarioId?: string | undefined;
  seedPrefix?: string | undefined;
  strategyKey?: string | undefined;
}

export interface EnqueueSeasonSimulationExecutionJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> extends EnqueuePlatformJobInput<TRepository> {
  simulationRunId: string;
  runCount: number;
  seedPrefix?: string | undefined;
  seasonSimulation: SeasonSimulationExecutionJobInput;
}

export interface EnqueueHistoricalImportParseJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> extends EnqueuePlatformJobInput<TRepository> {
  seasonYear: number;
  fileHash: string;
  sourceFilename: string;
  contentType?: string | undefined;
  mappingConfig?: JsonObject | undefined;
  replacementRequested?: boolean | undefined;
}

export interface EnqueuePricingRebuildJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> extends EnqueuePlatformJobInput<TRepository> {
  seasonYear: number;
  modelVersion: string;
  inputSnapshotId: string;
  inputHash: string;
  scenarioIds: readonly string[];
  reason: PricingRebuildReason;
  strategyOverlayIds?: readonly string[] | undefined;
}

export interface EnqueueDraftRoomExportJobInput<
  TRepository extends PlatformJobAsyncSubmitRepository = PlatformJobSubmitRepository,
> extends EnqueuePlatformJobInput<TRepository> {
  draftRoomId: string;
  format: DraftRoomExportFormat;
  sourceRevision: number;
}
