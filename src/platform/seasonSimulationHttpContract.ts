import type {
  SeasonSimulationResult,
  SeasonSimulationRunResult,
} from "./seasonSimulationEngine.js";

export interface SeasonSimulationOutcomeSummary {
  favorite: boolean;
  rank: number;
  runNumber: number;
  userWeek1Points: number;
}

export type SeasonSimulationSummary = Omit<SeasonSimulationResult, "runs"> & {
  outcomes: readonly SeasonSimulationOutcomeSummary[];
};

const outcomeSummaries = (
  simulation: SeasonSimulationResult,
  favoriteRunNumbers: readonly number[],
): readonly SeasonSimulationOutcomeSummary[] => simulation.runs
  .map(run => ({
    favorite: favoriteRunNumbers.includes(run.runNumber),
    runNumber: run.runNumber,
    userWeek1Points: run.teams.find(team => team.isUserTeam)?.week1Points ?? 0,
  }))
  .sort((left, right) =>
    right.userWeek1Points - left.userWeek1Points || left.runNumber - right.runNumber)
  .map((outcome, index) => ({ ...outcome, rank: index + 1 }));

export const summarizeSeasonSimulation = (
  simulation: SeasonSimulationResult,
  favoriteRunNumbers: readonly number[] = [],
): SeasonSimulationSummary => ({
  completedCount: simulation.completedCount,
  draftFormat: simulation.draftFormat,
  playerExposure: simulation.playerExposure,
  positionCounts: simulation.positionCounts,
  outcomes: outcomeSummaries(simulation, favoriteRunNumbers),
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
