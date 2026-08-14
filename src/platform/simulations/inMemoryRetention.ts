import { maximumRetainedSimulationRunsPerUser } from "../simulationLimits.js";
import { SimulationError } from "./errors.js";
import type { InMemorySimulationState } from "./inMemoryState.js";
import type { SimulationRunStatus } from "./runContracts.js";

const isTerminal = (status: SimulationRunStatus): boolean =>
  status === "completed" || status === "failed" || status === "canceled";

export const makeSimulationRetentionRoom = (
  state: InMemorySimulationState,
  userId: string,
): void => {
  const userRuns = state.values().filter(run => run.request.userId === userId);
  const removalCount = userRuns.length - maximumRetainedSimulationRunsPerUser + 1;
  if (removalCount <= 0) return;

  const removableRuns = userRuns
    .filter(run => isTerminal(run.status))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .slice(0, removalCount);
  if (removableRuns.length < removalCount) {
    throw new SimulationError(
      "simulation_capacity_reached",
      "Finish or cancel an active simulation before starting another one.",
    );
  }
  for (const run of removableRuns) state.delete(run);
};
