import type {
  SeasonSimulationResult,
  SeasonSimulationRunResult,
} from "./seasonSimulationEngine.js";

export type SeasonSimulationSummary = Omit<SeasonSimulationResult, "runs">;

export const summarizeSeasonSimulation = (
  simulation: SeasonSimulationResult,
): SeasonSimulationSummary => ({
  completedCount: simulation.completedCount,
  draftFormat: simulation.draftFormat,
  playerExposure: simulation.playerExposure,
  positionCounts: simulation.positionCounts,
  ...(simulation.preferenceOutcomes === undefined
    ? {}
    : { preferenceOutcomes: simulation.preferenceOutcomes }),
  runCount: simulation.runCount,
  seedPrefix: simulation.seedPrefix,
  strategy: simulation.strategy,
  ...(simulation.targetOutcome === undefined
    ? {}
    : { targetOutcome: simulation.targetOutcome }),
  ...(simulation.targetOutcomes === undefined
    ? {}
    : { targetOutcomes: simulation.targetOutcomes }),
});

export const simulationRunForNumber = (
  simulation: SeasonSimulationResult,
  runNumber: number,
): SeasonSimulationRunResult | undefined => simulation.runs.find(run => run.runNumber === runNumber);
