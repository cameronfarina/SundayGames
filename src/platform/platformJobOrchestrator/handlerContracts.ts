import type { JobKind, JobProgress, JobRecord, MaybePromise } from "../jobs.js";
import type {
  DraftRoomExportJobPayload,
  HistoricalImportParseJobPayload,
  PlatformJobPayload,
  PricingRebuildJobPayload,
  SimulationRunExecutionJobPayload,
  SeasonSimulationExecutionJobPayload,
} from "./payloads.js";
import type { PlatformJobRepository } from "./repositoryContracts.js";
import type {
  DraftRoomExportJobResult,
  HistoricalImportParseJobResult,
  PlatformJobResult,
  PricingRebuildJobResult,
  SimulationRunExecutionJobResult,
  SeasonSimulationExecutionJobResult,
} from "./results.js";
import { platformJobTypes } from "./platformJobTypes.js";

export interface PlatformJobHandlerContext {
  job: JobRecord;
  workerId: string;
  updateProgress: (progress: JobProgress, now?: Date) => MaybePromise<JobRecord>;
  heartbeat: (input?: { now?: Date | undefined; lockTtlMs?: number | undefined }) => MaybePromise<JobRecord>;
}

export type PlatformJobHandler<Payload extends PlatformJobPayload, Result extends PlatformJobResult> = (
  payload: Payload,
  context: PlatformJobHandlerContext,
) => Result | Promise<Result>;

export type PlatformJobHandlers = {
  [platformJobTypes.simulationRunExecution]: PlatformJobHandler<
    SimulationRunExecutionJobPayload,
    SimulationRunExecutionJobResult
  >;
  [platformJobTypes.seasonSimulationExecution]: PlatformJobHandler<
    SeasonSimulationExecutionJobPayload,
    SeasonSimulationExecutionJobResult
  >;
  [platformJobTypes.historicalImportParse]: PlatformJobHandler<
    HistoricalImportParseJobPayload,
    HistoricalImportParseJobResult
  >;
  [platformJobTypes.pricingRebuild]: PlatformJobHandler<
    PricingRebuildJobPayload,
    PricingRebuildJobResult
  >;
  [platformJobTypes.draftRoomExport]: PlatformJobHandler<
    DraftRoomExportJobPayload,
    DraftRoomExportJobResult
  >;
};

export type PlatformJobHeartbeatScheduler = (
  heartbeat: () => Promise<void>,
  intervalMs: number,
) => () => void;

export interface DispatchNextPlatformJobInput {
  repository: PlatformJobRepository;
  workerId: string;
  handlers: Partial<PlatformJobHandlers>;
  now?: Date | undefined;
  lockTtlMs?: number | undefined;
  jobKinds?: readonly JobKind[] | undefined;
  heartbeatIntervalMs?: number | undefined;
  heartbeatScheduler?: PlatformJobHeartbeatScheduler | undefined;
}
