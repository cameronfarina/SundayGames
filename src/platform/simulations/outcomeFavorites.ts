import { SimulationError } from "./errors.js";
import type { SimulationResult } from "./runContracts.js";

export const resultWithOutcomeFavorite = (
  result: SimulationResult | undefined,
  runNumber: number,
  favorite: boolean,
): SimulationResult => {
  const simulation = result?.seasonSimulation;
  if (result === undefined || simulation === undefined ||
      !simulation.runs.some(run => run.runNumber === runNumber)) {
    throw new SimulationError("simulation_not_found", "Simulation outcome was not found.");
  }
  const current = result.favoriteRunNumbers ?? [];
  const favoriteRunNumbers = favorite
    ? [...new Set([...current, runNumber])].sort((left, right) => left - right)
    : current.filter(candidate => candidate !== runNumber);
  return { ...result, favoriteRunNumbers };
};
