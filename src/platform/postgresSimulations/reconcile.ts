import { reconcileAbandonedSimulationRunsSql } from "./sql.js";
import type { SimulationRepositoryContext } from "./types.js";

const simulationReconciliationAdvisoryLockKeys: readonly [number, number] = [
  1_397_355_109,
  1_009_110_321,
];

export const reconcileAbandoned = async (
  context: SimulationRepositoryContext,
  now: Date,
): Promise<void> => await context.client.transaction(async client => {
  const lock = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_xact_lock($1, $2) AS acquired",
    simulationReconciliationAdvisoryLockKeys,
  );
  if (lock.rows[0]?.acquired !== true) return;
  await client.query(reconcileAbandonedSimulationRunsSql, [now]);
});
