import { maximumRetainedSimulationRunsPerUser } from "../simulationLimits.js";
import type { InMemorySimulationState } from "./inMemoryState.js";

const abandonedRequestLifetimeMs = 60 * 60 * 1_000;

export const makeSimulationRetentionRoom = (
  state: InMemorySimulationState,
  userId: string,
  now: Date,
): void => {
  const userRuns = state.values().filter(run => run.request.userId === userId);
  const allCompletedRuns = userRuns
    .filter(run => run.status === "completed")
    .sort((left, right) =>
      (left.completedAt ?? left.createdAt).getTime() -
      (right.completedAt ?? right.createdAt).getTime());
  const completedRuns = allCompletedRuns.slice(
    0,
    Math.max(allCompletedRuns.length - maximumRetainedSimulationRunsPerUser, 0),
  );
  const cutoff = now.getTime() - abandonedRequestLifetimeMs;
  const removableRuns = userRuns.filter(run =>
    run.status === "failed" || run.status === "canceled" ||
    (run.status === "requested" && run.createdAt.getTime() < cutoff));
  for (const run of [...completedRuns, ...removableRuns]) state.delete(run);
};
