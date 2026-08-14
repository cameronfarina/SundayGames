import { maximumSimulationStrategyElementLength } from "../simulationLimits.js";
import { SimulationError } from "./errors.js";

export const assertSimulationStrategyText = (value: string): void => {
  if (value.length > maximumSimulationStrategyElementLength) {
    throw new SimulationError(
      "simulation_strategy_too_large",
      `A simulation strategy name cannot exceed ${maximumSimulationStrategyElementLength} characters.`,
    );
  }
};

export const normalizedPlayerKey = (playerName: string): string =>
  playerName.trim().toLowerCase().replace(/\s+/g, " ");
