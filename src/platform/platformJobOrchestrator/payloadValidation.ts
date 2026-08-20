import type { JsonValue } from "../jobs.js";
import {
  isJsonObject,
  isNonNegativeInteger,
  isOptionalBoolean,
  isOptionalJsonObject,
  isOptionalString,
  isPositiveInteger,
  isStringArray,
} from "./jsonValidation.js";
import type {
  DraftRoomExportJobPayload,
  HistoricalImportParseJobPayload,
  PricingRebuildJobPayload,
  SimulationRunExecutionJobPayload,
  SeasonSimulationExecutionJobPayload,
} from "./payloads.js";
import {
  platformJobTypes,
  type DraftRoomExportFormat,
  type PlatformJobType,
  type PricingRebuildReason,
} from "./platformJobTypes.js";

export const platformJobTypeFrom = (value: JsonValue): PlatformJobType | null => {
  if (!isJsonObject(value)) return null;

  switch (value.type) {
    case platformJobTypes.simulationRunExecution:
    case platformJobTypes.seasonSimulationExecution:
    case platformJobTypes.historicalImportParse:
    case platformJobTypes.pricingRebuild:
    case platformJobTypes.draftRoomExport:
      return value.type;
    default:
      return null;
  }
};

const isPricingRebuildReason = (
  value: JsonValue | undefined,
): value is PricingRebuildReason => {
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

const isDraftRoomExportFormat = (
  value: JsonValue | undefined,
): value is DraftRoomExportFormat => value === "csv" || value === "xlsx";

const isSeasonSimulationExecutionJobInput = (
  value: JsonValue | undefined,
): boolean => (
  value !== undefined
  && isJsonObject(value)
  && value.input !== undefined
  && isJsonObject(value.input)
  && typeof value.strategyText === "string"
  && isOptionalString(value.note)
);

export const isSimulationRunExecutionJobPayload = (
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

export const isSeasonSimulationExecutionJobPayload = (
  value: JsonValue,
): value is SeasonSimulationExecutionJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.seasonSimulationExecution
    && typeof value.simulationRunId === "string"
    && isPositiveInteger(value.runCount)
    && isOptionalString(value.seedPrefix)
    && isSeasonSimulationExecutionJobInput(value.seasonSimulation);

export const isHistoricalImportParseJobPayload = (
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

export const isPricingRebuildJobPayload = (
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

export const isDraftRoomExportJobPayload = (
  value: JsonValue,
): value is DraftRoomExportJobPayload =>
  isJsonObject(value)
    && value.type === platformJobTypes.draftRoomExport
    && typeof value.draftRoomId === "string"
    && isDraftRoomExportFormat(value.format)
    && isNonNegativeInteger(value.sourceRevision);
