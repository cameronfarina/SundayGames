interface PlatformJobTypeMap {
  readonly simulationRunExecution: "simulation-run-execution";
  readonly seasonSimulationExecution: "season-simulation-execution-v1";
  readonly historicalImportParse: "historical-import-parse";
  readonly pricingRebuild: "pricing-rebuild";
  readonly draftRoomExport: "draft-room-export";
}

export const platformJobTypes: PlatformJobTypeMap = {
  simulationRunExecution: "simulation-run-execution",
  seasonSimulationExecution: "season-simulation-execution-v1",
  historicalImportParse: "historical-import-parse",
  pricingRebuild: "pricing-rebuild",
  draftRoomExport: "draft-room-export",
};

export type PlatformJobType = PlatformJobTypeMap[keyof PlatformJobTypeMap];

export type PricingRebuildReason =
  | "historical-import-committed"
  | "projection-refresh"
  | "keeper-change"
  | "manual"
  | "live-draft-state";

export type DraftRoomExportFormat = "csv" | "xlsx";
