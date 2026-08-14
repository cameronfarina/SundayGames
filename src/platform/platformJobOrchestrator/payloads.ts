import type { JsonObject } from "../jobs.js";
import {
  platformJobTypes,
  type DraftRoomExportFormat,
  type PricingRebuildReason,
} from "./platformJobTypes.js";

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
