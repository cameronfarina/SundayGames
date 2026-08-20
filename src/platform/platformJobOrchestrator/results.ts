import type { JsonObject } from "../jobs.js";
import {
  platformJobTypes,
  type DraftRoomExportFormat,
} from "./platformJobTypes.js";

export interface SimulationRunExecutionJobResult extends JsonObject {
  type: typeof platformJobTypes.simulationRunExecution;
  simulationRunId: string;
  resultSetId?: string | undefined;
  runCount: number;
  completedRunCount: number;
  summaryRef?: string | undefined;
  warningCount?: number | undefined;
}

export interface SeasonSimulationExecutionJobResult extends JsonObject {
  type: typeof platformJobTypes.seasonSimulationExecution;
  simulationRunId: string;
  runCount: number;
  completedRunCount: number;
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
  | SeasonSimulationExecutionJobResult
  | HistoricalImportParseJobResult
  | PricingRebuildJobResult
  | DraftRoomExportJobResult;
