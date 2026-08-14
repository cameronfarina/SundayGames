import {
  boundedSimulationHistoryPageSize,
  maximumSimulationHistoryPageSize,
} from "../simulationLimits.js";
import type { InMemorySimulationState } from "./inMemoryState.js";
import { canReadSimulationRun } from "./privacy.js";
import type { SimulationRun } from "./runContracts.js";

const newestFirst = (left: SimulationRun, right: SimulationRun): number =>
  right.createdAt.getTime() - left.createdAt.getTime();

export const listInMemorySimulationsForUser = (
  state: InMemorySimulationState,
  userId: string,
  limit = maximumSimulationHistoryPageSize,
): SimulationRun[] => state.values()
  .filter(run => canReadSimulationRun(userId, run))
  .sort(newestFirst)
  .slice(0, boundedSimulationHistoryPageSize(limit))
  .map(run => ({ ...run, result: undefined }));

export const listInMemorySimulationHistoryForSeason = (
  state: InMemorySimulationState,
  userId: string,
  seasonId: string,
  limit: number,
): SimulationRun[] => state.values()
  .filter(run => canReadSimulationRun(userId, run))
  .filter(run => run.request.seasonId === seasonId)
  .sort(newestFirst)
  .slice(0, boundedSimulationHistoryPageSize(limit))
  .map(run => ({
    ...run,
    result: run.result?.seasonSimulation === undefined
      ? run.result
      : {
          ...run.result,
          seasonSimulation: { ...run.result.seasonSimulation, runs: [] },
        },
  }));
