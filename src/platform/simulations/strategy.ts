import { maximumStructuredSimulationStrategyCharacters } from "../simulationLimits.js";
import { SimulationError } from "./errors.js";
import { normalizeHardLocks } from "./hardLocks.js";
import { normalizeSoftTargets } from "./softTargets.js";
import type { SimulationStrategy, SimulationStrategyInput } from "./strategyContracts.js";

const strategyCharacterCount = (strategy: SimulationStrategy): number =>
  strategy.hardLocks.reduce(
    (total, hardLock) => total + hardLock.playerName.length,
    strategy.softTargets.reduce(
      (total, target) => total + target.label.length
        + target.candidatePool.reduce((sum, candidate) => sum + candidate.length, 0),
      0,
    ),
  );

export const normalizeStrategy = (strategy: SimulationStrategyInput): SimulationStrategy => {
  const normalized = {
    hardLocks: normalizeHardLocks(strategy.hardLocks),
    softTargets: normalizeSoftTargets(strategy.softTargets),
  };
  if (strategyCharacterCount(normalized) > maximumStructuredSimulationStrategyCharacters) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `Structured simulation strategy text cannot exceed ${maximumStructuredSimulationStrategyCharacters} characters.`,
    );
  }
  return normalized;
};
