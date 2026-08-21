import { SimulationError, type SimulationRun } from "../simulations.js";
import { findById, findRequired } from "./lookups.js";
import type { SimulationRepositoryContext } from "./types.js";

export const markCanceled = async (
  context: SimulationRepositoryContext,
  runId: string,
): Promise<SimulationRun> => await context.client.transaction(async client => {
  const existingRun = await findById(runId, client);
  if (existingRun === null) {
    throw new SimulationError("simulation_not_found", "Simulation run was not found.");
  }
  if (existingRun.status !== "requested" && existingRun.status !== "running") return existingRun;
  const now = new Date();
  const transition = await client.query<{ id: string }>(`
UPDATE simulation_runs
SET status = 'canceled',
    completed_at = NULL,
    updated_at = $2
WHERE id = $1
  AND status IN ('requested', 'running')
RETURNING id
`.trim(), [runId, now]);
  if (transition.rows.length === 0) return await findRequired(runId, client);
  return await findRequired(runId, client);
});

export const resetForRerun = async (
  context: SimulationRepositoryContext,
  runId: string,
): Promise<SimulationRun> => await context.client.transaction(async client => {
  const existingRun = await findById(runId, client);
  if (existingRun === null) {
    throw new SimulationError("simulation_not_found", "Simulation run was not found.");
  }
  if (existingRun.status === "running") return existingRun;
  const now = new Date();
  await client.query(`
UPDATE simulation_runs
SET status = 'requested',
    started_at = NULL,
    completed_at = NULL,
    updated_at = $2
WHERE id = $1
`.trim(), [runId, now]);
  await client.query("DELETE FROM simulation_results WHERE simulation_run_id = $1", [runId]);
  return await findRequired(runId, client);
});
