export const maximumSimulationHardLocks = 32;
export const maximumSimulationSoftTargets = 16;
export const maximumSimulationCandidatePoolSize = 32;
export const maximumSimulationStrategyElementLength = 160;
export const maximumStructuredSimulationStrategyCharacters = 16_000;
export const maximumSimulationStrategyTextLength = 4_000;
export const maximumSimulationNoteLength = 1_000;
export const maximumSimulationIdentifierLength = 128;
export const maximumRetainedSimulationRunsPerUser = 25;
export const maximumSimulationHistoryPageSize = 25;

export const boundedSimulationHistoryPageSize = (requested: number): number =>
  Number.isInteger(requested) && requested > 0
    ? Math.min(requested, maximumSimulationHistoryPageSize)
    : maximumSimulationHistoryPageSize;
