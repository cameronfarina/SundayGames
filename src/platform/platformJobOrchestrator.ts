import type {
  JobRepository,
  JobKind,
  JobProgress,
  SubmitJobInput,
  JobRecord,
  JsonObject,
  JsonValue,
  MaybePromise,
} from "./jobs.js";

export const platformJobTypes = {
  simulationRunExecution: "simulation-run-execution",
  historicalImportParse: "historical-import-parse",
  pricingRebuild: "pricing-rebuild",
  draftRoomExport: "draft-room-export",
} as const;

export type PlatformJobType = typeof platformJobTypes[keyof typeof platformJobTypes];

export type PricingRebuildReason =
  | "historical-import-committed"
  | "projection-refresh"
  | "keeper-change"
  | "manual"
  | "live-draft-state";

export type DraftRoomExportFormat = "csv" | "xlsx";

export interface SimulationRunExecutionJobPayload extends JsonObject {
  type: typeof platformJobTypes.simulationRunExecution;
  simulationRunId: string;
  runCount: number;
  modelRunId?: string | undefined;
  keeperScenarioId?: string | undefined;
  seedPrefix?: string | undefined;
  strategyKey?: string | undefined;
}

export interface HistoricalImportParseJobPayload extends JsonObject {
  type: typeof platformJobTypes.historicalImportParse;
  seasonYear: number;
  fileHash: string;
  sourceFilename: string;
  contentType?: string | undefined;
  mappingConfig?: JsonObject | undefined;
  replacementRequested?: boolean | undefined;
}

export interface PricingRebuildJobPayload extends JsonObject {
  type: typeof platformJobTypes.pricingRebuild;
  seasonYear: number;
  modelVersion: string;
  inputSnapshotId: string;
  inputHash: string;
  scenarioIds: readonly string[];
  reason: PricingRebuildReason;
  strategyOverlayIds?: readonly string[] | undefined;
}

export interface DraftRoomExportJobPayload extends JsonObject {
  type: typeof platformJobTypes.draftRoomExport;
  draftRoomId: string;
  format: DraftRoomExportFormat;
  sourceRevision: number;
}

export type PlatformJobPayload =
  | SimulationRunExecutionJobPayload
  | HistoricalImportParseJobPayload
  | PricingRebuildJobPayload
  | DraftRoomExportJobPayload;

export interface SimulationRunExecutionJobResult extends JsonObject {
  type: typeof platformJobTypes.simulationRunExecution;
  simulationRunId: string;
  resultSetId?: string | undefined;
  runCount: number;
  completedRunCount: number;
  summaryRef?: string | undefined;
  warningCount?: number | undefined;
}

export interface HistoricalImportParseJobResult extends JsonObject {
  type: typeof platformJobTypes.historicalImportParse;
  importBatchId: string;
  rowCount: number;
  readyRowCount: number;
  blockerCount: number;
  warningCount: number;
}

export interface PricingRebuildJobResult extends JsonObject {
  type: typeof platformJobTypes.pricingRebuild;
  modelRunId: string;
  pricingSnapshotIds: readonly string[];
  scenarioCount: number;
  warningCount: number;
}

export interface DraftRoomExportJobResult extends JsonObject {
  type: typeof platformJobTypes.draftRoomExport;
  draftRoomId: string;
  format: DraftRoomExportFormat;
  artifactId: string;
  storageKey: string;
  rowCount: number;
}

export type PlatformJobResult =
  | SimulationRunExecutionJobResult
  | HistoricalImportParseJobResult
  | PricingRebuildJobResult
  | DraftRoomExportJobResult;

export type PlatformJobRepository = Pick<
  JobRepository,
  "claimNextJob" | "updateProgress" | "heartbeatJob" | "completeJob" | "failJob"
>;

export interface PlatformJobSubmitRepository {
  submit(input: SubmitJobInput): JobRecord;
}

export interface PlatformJobAsyncSubmitRepository {
  submit(input: SubmitJobInput): MaybePromise<JobRecord>;
}

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

export type PlatformJobOrchestratorErrorCode =
  | "invalid_payload"
  | "missing_handler"
  | "unknown_job_type";

export class PlatformJobOrchestratorError extends Error {
  readonly code: PlatformJobOrchestratorErrorCode;

  constructor(code: PlatformJobOrchestratorErrorCode, message: string) {
    super(message);
    this.name = "PlatformJobOrchestratorError";
    this.code = code;
  }
}

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

export interface DispatchNextPlatformJobInput {
  repository: PlatformJobRepository;
  workerId: string;
  handlers: Partial<PlatformJobHandlers>;
  now?: Date | undefined;
  lockTtlMs?: number | undefined;
  jobKinds?: readonly JobKind[] | undefined;
}

const platformJobKinds: Record<PlatformJobType, JobKind> = {
  [platformJobTypes.simulationRunExecution]: "simulation",
  [platformJobTypes.historicalImportParse]: "import",
  [platformJobTypes.pricingRebuild]: "model_run",
  [platformJobTypes.draftRoomExport]: "export",
};

const idempotencyKeyFor = (
  type: PlatformJobType,
  explicitKey: string | undefined,
  defaultParts: readonly (string | number)[],
): string =>
  [type, explicitKey ?? defaultParts.join(":")].join(":");

const submitPlatformJob = <TRepository extends PlatformJobAsyncSubmitRepository>({
  repository,
  userId,
  leagueId,
  seasonId,
  idempotencyKey,
  maxAttempts,
  now,
  payload,
  defaultIdempotencyKeyParts,
}: EnqueuePlatformJobInput<TRepository> & {
  payload: PlatformJobPayload;
  defaultIdempotencyKeyParts: readonly (string | number)[];
}): ReturnType<TRepository["submit"]> =>
  repository.submit({
    userId,
    leagueId,
    seasonId,
    kind: platformJobKinds[payload.type],
    inputJson: payload,
    idempotencyKey: idempotencyKeyFor(payload.type, idempotencyKey, defaultIdempotencyKeyParts),
    maxAttempts,
    now,
  }) as ReturnType<TRepository["submit"]>;

export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: SimulationRunExecutionJobPayload = {
    type: platformJobTypes.simulationRunExecution,
    simulationRunId: input.simulationRunId,
    runCount: input.runCount,
  };
  if (input.modelRunId !== undefined) payload.modelRunId = input.modelRunId;
  if (input.keeperScenarioId !== undefined) payload.keeperScenarioId = input.keeperScenarioId;
  if (input.seedPrefix !== undefined) payload.seedPrefix = input.seedPrefix;
  if (input.strategyKey !== undefined) payload.strategyKey = input.strategyKey;

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [input.simulationRunId],
  });
}

export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: HistoricalImportParseJobPayload = {
    type: platformJobTypes.historicalImportParse,
    seasonYear: input.seasonYear,
    fileHash: input.fileHash,
    sourceFilename: input.sourceFilename,
  };
  if (input.contentType !== undefined) payload.contentType = input.contentType;
  if (input.mappingConfig !== undefined) payload.mappingConfig = input.mappingConfig;
  if (input.replacementRequested !== undefined) payload.replacementRequested = input.replacementRequested;

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [input.seasonYear, input.fileHash],
  });
}

export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: PricingRebuildJobPayload = {
    type: platformJobTypes.pricingRebuild,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    inputSnapshotId: input.inputSnapshotId,
    inputHash: input.inputHash,
    scenarioIds: [...input.scenarioIds],
    reason: input.reason,
  };
  if (input.strategyOverlayIds !== undefined) {
    payload.strategyOverlayIds = [...input.strategyOverlayIds];
  }

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [
      input.modelVersion,
      input.inputSnapshotId,
      input.scenarioIds.join(","),
    ],
  });
}

export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: DraftRoomExportJobPayload = {
    type: platformJobTypes.draftRoomExport,
    draftRoomId: input.draftRoomId,
    format: input.format,
    sourceRevision: input.sourceRevision,
  };

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [input.draftRoomId, input.sourceRevision, input.format],
  });
}

export const dispatchNextPlatformJob = async ({
  repository,
  workerId,
  handlers,
  now,
  lockTtlMs,
  jobKinds,
}: DispatchNextPlatformJobInput): Promise<JobRecord | null> => {
  const dispatchAt = now ?? new Date();
  const job = await repository.claimNextJob({
    workerId,
    now: dispatchAt,
    lockTtlMs,
    kinds: jobKinds,
  });

  if (job === null) return null;

  try {
    const resultSummary = await runClaimedPlatformJob({
      repository,
      workerId,
      job,
      handlers,
    });
    const completedAt = now ?? new Date();

    return await repository.completeJob({
      jobId: job.id,
      workerId,
      resultSummary,
      now: completedAt,
    });
  } catch (error) {
    const failedAt = now ?? new Date();

    return await repository.failJob({
      jobId: job.id,
      workerId,
      error,
      now: failedAt,
    });
  }
};

const runClaimedPlatformJob = async ({
  repository,
  workerId,
  job,
  handlers,
}: {
  repository: PlatformJobRepository;
  workerId: string;
  job: JobRecord;
  handlers: Partial<PlatformJobHandlers>;
}): Promise<PlatformJobResult> => {
  const type = platformJobTypeFrom(job.inputJson);
  const context = handlerContextFor(repository, job, workerId);

  switch (type) {
    case platformJobTypes.simulationRunExecution: {
      if (!isSimulationRunExecutionJobPayload(job.inputJson)) {
        throw invalidPayloadError(type);
      }

      const handler = handlers[type];
      if (handler === undefined) throw missingHandlerError(type);

      return handler(job.inputJson, context);
    }
    case platformJobTypes.historicalImportParse: {
      if (!isHistoricalImportParseJobPayload(job.inputJson)) {
        throw invalidPayloadError(type);
      }

      const handler = handlers[type];
      if (handler === undefined) throw missingHandlerError(type);

      return handler(job.inputJson, context);
    }
    case platformJobTypes.pricingRebuild: {
      if (!isPricingRebuildJobPayload(job.inputJson)) {
        throw invalidPayloadError(type);
      }

      const handler = handlers[type];
      if (handler === undefined) throw missingHandlerError(type);

      return handler(job.inputJson, context);
    }
    case platformJobTypes.draftRoomExport: {
      if (!isDraftRoomExportJobPayload(job.inputJson)) {
        throw invalidPayloadError(type);
      }

      const handler = handlers[type];
      if (handler === undefined) throw missingHandlerError(type);

      return handler(job.inputJson, context);
    }
    case null:
      throw new PlatformJobOrchestratorError(
        "unknown_job_type",
        "Job input does not contain a known platform job type.",
      );
  }
};

const handlerContextFor = (
  repository: PlatformJobRepository,
  job: JobRecord,
  workerId: string,
): PlatformJobHandlerContext => ({
  job,
  workerId,
  updateProgress: async (progress, now) =>
    await repository.updateProgress({
      jobId: job.id,
      workerId,
      progress,
      now,
    }),
  heartbeat: async input =>
    await repository.heartbeatJob({
      jobId: job.id,
      workerId,
      now: input?.now,
      lockTtlMs: input?.lockTtlMs,
    }),
});

const platformJobTypeFrom = (value: JsonValue): PlatformJobType | null => {
  if (!isJsonObject(value)) return null;

  switch (value.type) {
    case platformJobTypes.simulationRunExecution:
    case platformJobTypes.historicalImportParse:
    case platformJobTypes.pricingRebuild:
    case platformJobTypes.draftRoomExport:
      return value.type;
    default:
      return null;
  }
};

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: JsonValue | undefined): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const isOptionalString = (value: JsonValue | undefined): value is string | undefined =>
  value === undefined || typeof value === "string";

const isOptionalBoolean = (value: JsonValue | undefined): value is boolean | undefined =>
  value === undefined || typeof value === "boolean";

const isOptionalJsonObject = (value: JsonValue | undefined): value is JsonObject | undefined =>
  value === undefined || isJsonObject(value);

const isPositiveInteger = (value: JsonValue | undefined): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonNegativeInteger = (value: JsonValue | undefined): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPricingRebuildReason = (value: JsonValue | undefined): value is PricingRebuildReason => {
  switch (value) {
    case "historical-import-committed":
    case "projection-refresh":
    case "keeper-change":
    case "manual":
    case "live-draft-state":
      return true;
    default:
      return false;
  }
};

const isDraftRoomExportFormat = (value: JsonValue | undefined): value is DraftRoomExportFormat =>
  value === "csv" || value === "xlsx";

const isSimulationRunExecutionJobPayload = (
  value: JsonValue,
): value is SimulationRunExecutionJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.simulationRunExecution
    && typeof value.simulationRunId === "string"
    && isPositiveInteger(value.runCount)
    && isOptionalString(value.modelRunId)
    && isOptionalString(value.keeperScenarioId)
    && isOptionalString(value.seedPrefix)
    && isOptionalString(value.strategyKey);

const isHistoricalImportParseJobPayload = (
  value: JsonValue,
): value is HistoricalImportParseJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.historicalImportParse
    && isPositiveInteger(value.seasonYear)
    && typeof value.fileHash === "string"
    && typeof value.sourceFilename === "string"
    && isOptionalString(value.contentType)
    && isOptionalJsonObject(value.mappingConfig)
    && isOptionalBoolean(value.replacementRequested);

const isPricingRebuildJobPayload = (
  value: JsonValue,
): value is PricingRebuildJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.pricingRebuild
    && isPositiveInteger(value.seasonYear)
    && typeof value.modelVersion === "string"
    && typeof value.inputSnapshotId === "string"
    && typeof value.inputHash === "string"
    && isStringArray(value.scenarioIds)
    && value.scenarioIds.length > 0
    && isPricingRebuildReason(value.reason)
    && (value.strategyOverlayIds === undefined || isStringArray(value.strategyOverlayIds));

const isDraftRoomExportJobPayload = (
  value: JsonValue,
): value is DraftRoomExportJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.draftRoomExport
    && typeof value.draftRoomId === "string"
    && isDraftRoomExportFormat(value.format)
    && isNonNegativeInteger(value.sourceRevision);

const invalidPayloadError = (type: PlatformJobType): PlatformJobOrchestratorError =>
  new PlatformJobOrchestratorError(
    "invalid_payload",
    `Job input for ${type} is missing required fields.`,
  );

const missingHandlerError = (type: PlatformJobType): PlatformJobOrchestratorError =>
  new PlatformJobOrchestratorError(
    "missing_handler",
    `No platform job handler was registered for ${type}.`,
  );
